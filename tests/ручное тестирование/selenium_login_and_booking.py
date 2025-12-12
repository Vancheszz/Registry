"""Сценарий Selenium для проверки входа и создания записи на приём."""

import os
import time
from datetime import datetime, timedelta

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def build_driver() -> webdriver.Chrome:
    """Создаёт Chrome WebDriver, используя путь из переменной окружения CHROMEDRIVER."""
    chrome_driver_path = os.getenv("CHROMEDRIVER")
    service = Service(executable_path=chrome_driver_path) if chrome_driver_path else Service()
    options = Options()
    options.add_argument("--start-maximized")
    driver = webdriver.Chrome(service=service, options=options)
    return driver


def login(driver: webdriver.Chrome, base_url: str, username: str, password: str) -> None:
    """Проходит форму логина и дожидается перехода на дашборд."""
    driver.get(f"{base_url}/login")
    driver.find_element(By.NAME, "username").send_keys(username)
    driver.find_element(By.NAME, "password").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    WebDriverWait(driver, 10).until(EC.url_contains("dashboard"))


def create_appointment(driver: webdriver.Chrome, base_url: str) -> None:
    """Заполняет форму создания приёма в интерфейсе расписания."""
    driver.get(f"{base_url}/schedule")

    # Ожидаем кнопку добавления приёма и кликаем
    add_button = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-testid='add-shift']"))
    )
    add_button.click()

    # Выбираем дату завтра
    target_date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
    driver.find_element(By.NAME, "date").clear()
    driver.find_element(By.NAME, "date").send_keys(target_date)
    driver.find_element(By.NAME, "start_time").clear()
    driver.find_element(By.NAME, "start_time").send_keys("10:00")
    driver.find_element(By.NAME, "end_time").clear()
    driver.find_element(By.NAME, "end_time").send_keys("11:00")
    driver.find_element(By.NAME, "shift_type").send_keys("selenium-check")

    # Сохраняем запись и ждём появления в списке
    driver.find_element(By.CSS_SELECTOR, "button[data-testid='save-shift']").click()
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, f"//td[contains(., '{target_date}')]")
    ))


def main():
    base_url = os.getenv("SELENIUM_BASE_URL", "http://localhost:3000")
    username = os.getenv("SELENIUM_USERNAME", "doctor")
    password = os.getenv("SELENIUM_PASSWORD", "doctorpass")

    driver = build_driver()
    try:
        login(driver, base_url, username, password)
        create_appointment(driver, base_url)
        time.sleep(3)  # Даём время визуально убедиться в результате
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
