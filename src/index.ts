/**
 * Новый главный файл приложения
 */
import { app } from './architecture/App';
import './scss/styles.scss';
import { appStore } from './architecture/state/Store';

// Глобальные типы для TypeScript
declare global {
  interface Window {
    app: typeof app;
  }
}

/**
 * Инициализация приложения при загрузке DOM
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Инициализируем приложение
    await app.initialize();
    
    // Делаем приложение доступным глобально для отладки
    window.app = app;

  } catch (error) {
    console.error('Критическая ошибка при запуске приложения:', error);
    
    // Показываем ошибку пользователю
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-container';
    errorContainer.innerHTML = `
      <div class="error-message">
        <h2>Ошибка запуска приложения</h2>
        <p>Не удалось запустить приложение. Попробуйте обновить страницу.</p>
        <button onclick="location.reload()">Обновить страницу</button>
      </div>
    `;
    
    document.body.appendChild(errorContainer);
  }
});

/**
 * Обработка ошибок на уровне window
 */
window.addEventListener('error', (event) => {
  console.error('Глобальная ошибка:', event.error);
});

/**
 * Обработка необработанных промисов
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Необработанная ошибка промиса:', event.reason);
});

/**
 * Обработка завершения работы страницы
 */
window.addEventListener('beforeunload', () => {
  if (window.app) {
    window.app.destroy();
  }
});

// Экспортируем для возможного использования в других модулях
export { app }; 