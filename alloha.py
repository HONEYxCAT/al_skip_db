import asyncio
import json
import os
import subprocess
from playwright.async_api import async_playwright

# --- КОНФИГУРАЦИЯ ---
DB_FOLDER = "database"
INPUT_FILE = "ids.txt"
BASE_URL_TEMPLATE = "https://reyohoho-gitlab.vercel.app/movie/{}"
CONCURRENT_LIMIT = 20

# Глобальный лок для записи в файл
file_lock = asyncio.Lock()
# Глобальный лок для Git операций
git_lock = asyncio.Lock()

# ===========================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ===========================

def get_file_path(kp_id):
    # Мягкая оптимизация: безопасно создаем папку, если ее еще нет
    os.makedirs(DB_FOLDER, exist_ok=True)
    return os.path.join(DB_FOLDER, f"{kp_id}.json")

def is_movie_processed(kp_id):
    return os.path.exists(get_file_path(kp_id))

def save_movie_data(kp_id, data):
    path = get_file_path(kp_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    # print(f"   [SAVE] Сохранено в: {path}") # Слишком много шума в параллельном режиме

def parse_alloha_string(skip_str):
    if not skip_str: return []
    segments = []
    parts = skip_str.split(',')
    for index, part in enumerate(parts):
        try:
            start, end = map(int, part.split('-'))
            if start == 0 and end == 0: continue
            name = "Пропустить заставку" if index == 0 else "Пропустить титры"
            segments.append({"start": start, "end": end, "name": name})
        except ValueError: continue
    return segments

async def update_id_status_in_file(target_id, status_text, force_flush=False):
    async with file_lock:
        try:
            # Ленивая запись статусов: копим изменения и пишем батчами
            if not hasattr(update_id_status_in_file, "_pending_updates"):
                update_id_status_in_file._pending_updates = []

            if not force_flush:
                # Добавляем новый статус в очередь
                update_id_status_in_file._pending_updates.append((target_id, status_text))

                # Если еще не набралось 50 ID — просто выходим
                if len(update_id_status_in_file._pending_updates) < 50:
                    return

            # Если force_flush=True или набралось >= 50 ID — делаем запись
            pending = update_id_status_in_file._pending_updates
            if not pending:
                return

            update_id_status_in_file._pending_updates = []

            # Читаем и пишем синхронно внутри лока, это быстро
            with open(INPUT_FILE, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Готовим словарь для быстрых обновлений по ID
            pending_dict = {kp_id: status for kp_id, status in pending}

            new_lines = []
            for line in lines:
                parts = line.strip().split()
                if parts and parts[0] in pending_dict:
                    new_lines.append(f"{parts[0]} {pending_dict[parts[0]]}\n")
                else:
                    new_lines.append(line)

            with open(INPUT_FILE, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
        except Exception as e:
            print(f"   [FILE ERROR] Не удалось записать статус: {e}")

# ===========================
# GIT АВТОМАТИЗАЦИЯ
# ===========================

def git_autopush():
    print("\n" + "="*30)
    print("ЗАПУСК GIT AUTO-PUSH")
    print("="*30)
    try:
        print("1. Добавляю файлы...")
        subprocess.run(["git", "add", "database"], check=True)

        print("2. Создаю коммит...")
        commit_result = subprocess.run(
            ["git", "commit", "-m", "Update database [Auto-Bot]"],
            capture_output=True, text=True
        )

        if "nothing to commit" in commit_result.stdout:
            print("   -> Нет новых изменений для коммита.")

        print("3. Отправляю на GitHub...")
        try:
            subprocess.run(["git", "push", "origin", "main"], check=True)
            print("\n[SUCCESS] Успешно!")
        except subprocess.CalledProcessError:
            print("   [WARN] Push отклонен (рассинхронизация). Выполняю git pull --rebase...")
            # Пытаемся подтянуть изменения с сервера
            subprocess.run(["git", "pull", "--rebase", "origin", "main"], check=True)
            print("   [INFO] Pull успешен. Повторяю push...")
            # Пробуем отправить снова
            subprocess.run(["git", "push", "origin", "main"], check=True)
            print("\n[SUCCESS] Успешно (после обновления)!")

    except Exception as e:
        print(f"\n[ERROR] Git error: {e}")

# ===========================
# ЛОГИКА ПАРСИНГА (ASYNC)
# ===========================

async def inject_force_visible_styles(frame):
    try:
        await frame.evaluate("document.querySelector('video')?.pause()")
    except: pass

    js_code = """
        var style = document.createElement('style');
        style.innerHTML = `
            .selects { display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 999999 !important; }
            .allplay__controls { opacity: 1 !important; visibility: visible !important; }
            .selects.hidden { display: block !important; }
        `;
        document.head.appendChild(style);
        var selects = document.querySelector('.selects');
        if (selects) selects.classList.remove('hidden');
    """
    try:
        await frame.evaluate(js_code)
    except Exception as e:
        pass

async def ensure_menu_open(frame, selector_base):
    await inject_force_visible_styles(frame)
    opener = frame.locator(f'{selector_base} .select__item')
    dropdown = frame.locator(f'{selector_base} .select__drop')

    if await dropdown.is_visible(): return True

    try:
        await opener.scroll_into_view_if_needed()
        await opener.click(force=True)
        await dropdown.wait_for(state="visible", timeout=2000)
        return True
    except Exception:
        try:
            await opener.click(force=True)
            await dropdown.wait_for(state="visible", timeout=2000)
            return True
        except Exception:
            return False

async def find_active_episode_selector(frame):
    await inject_force_visible_styles(frame)
    locators = frame.locator('div[data-select^="episodeType"]')
    count = await locators.count()

    for i in range(count):
        el = locators.nth(i)
        if await el.is_visible():
            attr = await el.get_attribute("data-select")
            return f'div[data-select="{attr}"]'
    return None

async def scrape_episodes_in_current_view(frame, state, kp_id):
    episodes_data = {}
    await inject_force_visible_styles(frame)
    selector = await find_active_episode_selector(frame)

    if not selector or await frame.locator(selector).count() == 0:
        if state["last_skip"]: return {"1": state["last_skip"]}
        return {}

    if not await ensure_menu_open(frame, selector):
        return {}

    buttons = frame.locator(f'{selector} .select__drop-item')
    count = await buttons.count()
    # print(f"      [{kp_id}] Серий в сезоне: {count}")

    await frame.click('body', force=True, position={'x':0,'y':0})
    await frame.page.wait_for_timeout(200)

    # Оптимизация: счетчик пустых серий подряд в начале
    empty_start_count = 0
    has_data_in_season = False

    for i in range(count):
        if not await ensure_menu_open(frame, selector): continue

        btn = buttons.nth(i)
        ep_id = await btn.get_attribute("data-id")

        if i == 0 and state["last_skip"]:
             episodes_data[ep_id] = state["last_skip"]
             has_data_in_season = True
             await frame.click('body', force=True, position={'x':0,'y':0})
             continue

        state["last_skip"] = None
        await btn.scroll_into_view_if_needed()
        await btn.click(force=True)

        # print(f"      [{kp_id}] Серия {ep_id}...", end=" ", flush=True)
        await frame.page.wait_for_timeout(1200)

        if state["last_skip"]:
            episodes_data[ep_id] = state["last_skip"]
            has_data_in_season = True
            # print("OK")
        else:
            # Если данных нет и мы еще ничего не нашли в этом сезоне -> увеличиваем счетчик
            if not has_data_in_season:
                empty_start_count += 1
            # print("-")

        # Если первые 5 серий пустые - пропускаем сезон
        if empty_start_count >= 5:
            # print(f"      [{kp_id}] Пропуск сезона (нет данных в первых 5 сериях)")
            break

    return episodes_data

async def scrape_single_id(kp_id, browser):
    url = BASE_URL_TEMPLATE.format(kp_id)
    context = await browser.new_context(viewport={'width': 1280, 'height': 800})

    try:
        # Блокировка ресурсов
        await context.route("**/*", lambda route: route.abort() if route.request.resource_type in ["image", "font"] else route.continue_())

        page = await context.new_page()

        # Отключение анимаций
        try:
            await page.add_style_tag(content="*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }")
        except Exception: pass

        state = {"last_skip": None}

        async def handle_response(response):
            if "/bnsi/movies/" in response.url and response.request.method == "POST":
                try:
                    data = await response.json()
                    if "skipTime" in data:
                        state["last_skip"] = data.get('skipTime')
                except Exception: pass

        page.on("response", handle_response)

        # print(f"   [{kp_id}] Открываю страницу...")
        try:
            await page.goto(url, timeout=60000, wait_until="domcontentloaded")
        except Exception:
            # print(f"   [{kp_id}] Timeout загрузки")
            return None

        try:
            player_btn = page.locator(".players-list button, .player-btn").first
            try:
                await player_btn.wait_for(timeout=8000)
                text = await player_btn.inner_text()
                if "ALLOHA" not in text.strip().upper():
                    await player_btn.click()
                    await page.locator("text=ALLOHA").last.click()
                    await page.wait_for_timeout(3000)
            except Exception: pass
        except Exception: pass

        collected_data = {}
        try:
            iframe_handle = await page.wait_for_selector("iframe.responsive-iframe, iframe[src*='allarknow']", state="attached", timeout=15000)
            if not iframe_handle:
                return None

            frame = await iframe_handle.content_frame()
            await frame.wait_for_selector("video", timeout=15000)
            # print(f"   [{kp_id}] Плеер активен.")
            await page.wait_for_timeout(2000)
            await inject_force_visible_styles(frame)

        except Exception as e:
            # print(f"   [{kp_id}] Ошибка инициализации: {e}")
            return None

        season_selector = 'div[data-select^="seasonType"]'
        has_seasons = await frame.locator(season_selector).count() > 0

        if not has_seasons:
            collected_data["1"] = await scrape_episodes_in_current_view(frame, state, kp_id)
        else:
            active_season_selector = 'div[data-select="seasonType1"]'
            await inject_force_visible_styles(frame)

            if await ensure_menu_open(frame, active_season_selector):
                season_btns = frame.locator(f'{active_season_selector} .select__drop-item')
                season_count = await season_btns.count()
                # print(f"   [{kp_id}] Найдено сезонов: {season_count}")

                await frame.click('body', force=True, position={'x':0,'y':0})
                await page.wait_for_timeout(500)

                for s_idx in range(season_count):
                    if not await ensure_menu_open(frame, active_season_selector): continue

                    s_btn = season_btns.nth(s_idx)
                    s_id = await s_btn.get_attribute("data-id")
                    # s_name = await s_btn.inner_text()

                    # print(f"   [{kp_id}] Сезон {s_name}")
                    await s_btn.scroll_into_view_if_needed()
                    await s_btn.click(force=True)
                    await page.wait_for_timeout(2500)
                    await inject_force_visible_styles(frame)

                    episodes = await scrape_episodes_in_current_view(frame, state, kp_id)
                    if episodes:
                        collected_data[s_id] = episodes

        return collected_data

    finally:
        await context.close()

# ===========================
# WORKER
# ===========================

async def worker(name, queue, browser, stats):
    while True:
        # Проверка состояния браузера
        if not browser.is_connected():
            print(f"[{name}] Браузер закрыт. Остановка воркера.")
            queue.task_done()
            break

        # Получаем задачу
        try:
            kp_id = await queue.get()
        except asyncio.CancelledError:
            break

        try:
            if is_movie_processed(kp_id):
                print(f"[{name}] ID {kp_id}: УЖЕ ЕСТЬ.")
                queue.task_done()
                continue

            print(f"[{name}] ID {kp_id}: Обработка...")
            status = "Провал"

            try:
                scraped_data = await scrape_single_id(kp_id, browser)

                if scraped_data:
                    final_db = {}
                    for season_id, episodes in scraped_data.items():
                        final_db[season_id] = {}
                        for ep_id, skip_str in episodes.items():
                            segments = parse_alloha_string(skip_str)
                            if segments:
                                final_db[season_id][ep_id] = segments

                    if final_db:
                        save_movie_data(kp_id, final_db)
                        stats['success_count'] += 1
                        status = "Успешно"
                        print(f"[{name}] ID {kp_id}: [OK] Данные сохранены.")

                        # Проверяем, кратно ли 100 количество успешных
                        if stats['success_count'] > 0 and stats['success_count'] % 100 == 0:
                            print(f"\n[{name}] >>> Найдено {stats['success_count']} новых. Выполняю промежуточный Git Push...")
                            async with git_lock:
                                await asyncio.to_thread(git_autopush)
                    else:
                        print(f"[{name}] ID {kp_id}: [WARN] Пустые данные.")
                        status = "Пусто"
                else:
                    print(f"[{name}] ID {kp_id}: [FAIL] Ошибка парсинга.")
                    status = "Провал"

            except Exception as e:
                print(f"[{name}] ID {kp_id}: [ERROR] {e}")
                status = "Провал"
                # Если ошибка связана с закрытием браузера - прерываем цикл
                if "Target closed" in str(e) or "browser has been closed" in str(e):
                    print(f"[{name}] Критическая ошибка браузера. Остановка.")
                    queue.task_done()
                    break

            # Не записываем статус, если задача была отменена или браузер упал
            if browser.is_connected():
                await update_id_status_in_file(kp_id, status)

        except asyncio.CancelledError:
            print(f"[{name}] Задача отменена.")
            queue.task_done()
            break
        except Exception as e:
            print(f"[{name}] CRITICAL ERROR on {kp_id}: {e}")
        finally:
            queue.task_done()

async def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Файл {INPUT_FILE} не найден!")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        # Читаем ID, пропускаем пустые
        ids = [line.strip().split()[0] for line in f.readlines() if line.strip()]

    print(f"Всего ID: {len(ids)}")
    print(f"Запуск в {CONCURRENT_LIMIT} потоков...\n")

    queue = asyncio.Queue()

    # Заполняем очередь (с конца, как просили ранее)
    for kp_id in reversed(ids):
        queue.put_nowait(kp_id)

    stats = {'success_count': 0}

    async with async_playwright() as p:
        # Запускаем браузер (headless=True для снижения нагрузки)
        browser = await p.chromium.launch(headless=True)

        # Создаем воркеров
        tasks = []
        for i in range(CONCURRENT_LIMIT):
            task = asyncio.create_task(worker(f"Worker-{i+1}", queue, browser, stats))
            tasks.append(task)

        # Ждем завершения очереди
        try:
            await queue.join()
        except KeyboardInterrupt:
            print("\n[STOP] Остановка...")
        finally:
            # Отменяем воркеров
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            await browser.close()

    # Всегда дописываем оставшиеся статусы (даже если все были с ошибкой)
    await update_id_status_in_file(None, None, force_flush=True)

    if stats['success_count'] > 0:
        # Финальный пуш, если что-то осталось
        async with git_lock:
            await asyncio.to_thread(git_autopush)
    else:
        print("\n[GIT] Нет новых данных.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass


# Комманда для запуска этого скрипта
# python alloha.py

# Комманда для пуша новых данных
# git add database && git commit -m "update database" && git push origin main
# git add database al_skip_min.js && git commit -m "update database and al_skip_min" && git push origin main
