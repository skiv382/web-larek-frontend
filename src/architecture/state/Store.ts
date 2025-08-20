/**
 * Централизованное управление состоянием приложения
 * Реализует паттерн Observer для реактивных обновлений
 */
export type StateChangeCallback<T> = (newState: T, oldState: T) => void;

export interface StateSubscription<T> {
  id: string;
  callback: StateChangeCallback<T>;
  selector?: (state: T) => unknown;
}

/**
 * Базовый класс для всех состояний
 */
export abstract class BaseState<T> {
  protected _state: T;
  protected subscribers: Map<string, StateSubscription<T>> = new Map();
  protected subscriptionIdCounter = 0;

  constructor(initialState: T) {
    this._state = initialState;
  }

  /**
   * Получить текущее состояние
   */
  getState(): T {
    return this._state;
  }

  /**
   * Подписаться на изменения состояния
   */
  subscribe(callback: StateChangeCallback<T>, selector?: (state: T) => unknown): string {
    const id = `sub_${++this.subscriptionIdCounter}`;
    this.subscribers.set(id, { id, callback, selector });
    return id;
  }

  /**
   * Отписаться от изменений состояния
   */
  unsubscribe(id: string): boolean {
    return this.subscribers.delete(id);
  }

  /**
   * Уведомить всех подписчиков об изменении состояния
   */
  protected notifySubscribers(oldState: T): void {
    this.subscribers.forEach(({ callback, selector }) => {
      try {
        if (selector) {
          const selectedOld = selector(oldState);
          const selectedNew = selector(this._state);
          
          // Уведомляем только если выбранная часть изменилась
          if (JSON.stringify(selectedOld) !== JSON.stringify(selectedNew)) {
            callback(this._state, oldState);
          }
        } else {
          callback(this._state, oldState);
        }
      } catch (error) {
        console.error('Ошибка в подписчике состояния:', error);
      }
    });
  }

  /**
   * Обновить состояние (должен быть переопределен в наследниках)
   */
  protected abstract updateState(updater: (state: T) => T): void;
}

/**
 * Главное состояние приложения
 */
export interface AppStateData {
  catalog: {
    items: ProductItem[];
    loading: boolean;
    error: string | null;
  };
  basket: {
    items: BasketItem[];
    total: number;
    isOpen: boolean;
  };
  order: {
    payment: string;
    address: string;
    email: string;
    phone: string;
    lastOrderTotal: number;
    validation: {
      payment: string;
      address: string;
      email: string;
      phone: string;
    };
  };
  ui: {
    modal: {
      isOpen: boolean;
      content: string | null;
      product: ProductItem | null;
    };
    notifications: Notification[];
  };
}

/**
 * Уведомление в системе
 */
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  timestamp: number;
}

/**
 * Товар в каталоге
 */
export interface ProductItem {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  price: number | null;
  index: number;
}

/**
 * Товар в корзине
 */
export interface BasketItem {
  id: string;
  index: number;
  title: string;
  price: number;
}

/**
 * Главный store приложения
 */
export class AppStore extends BaseState<AppStateData> {
  constructor() {
    super({
      catalog: {
        items: [],
        loading: false,
        error: null
      },
      basket: {
        items: [],
        total: 0,
        isOpen: false
      },
      order: {
        payment: '',
        address: '',
        email: '',
        phone: '',
        lastOrderTotal: 0,
        validation: {
          payment: '',
          address: '',
          email: '',
          phone: ''
        }
      },
      ui: {
        modal: {
          isOpen: false,
          content: null,
          product: null
        },
        notifications: []
      }
    });
  }

  /**
   * Обновить состояние каталога
   */
  updateCatalog(updater: (catalog: AppStateData['catalog']) => AppStateData['catalog']): void {
    const oldState = { ...this._state };
    this._state = {
      ...this._state,
      catalog: updater(this._state.catalog)
    };
    this.notifySubscribers(oldState);
  }

  /**
   * Обновить состояние корзины
   */
  updateBasket(updater: (basket: AppStateData['basket']) => AppStateData['basket']): void {
    const oldState = { ...this._state };
    this._state = {
      ...this._state,
      basket: updater(this._state.basket)
    };
    this.notifySubscribers(oldState);
  }

  /**
   * Обновить состояние заказа
   */
  updateOrder(updater: (order: AppStateData['order']) => AppStateData['order']): void {
    const oldState = { ...this._state };
    this._state = {
      ...this._state,
      order: updater(this._state.order)
    };
    this.notifySubscribers(oldState);
  }

  /**
   * Обновить UI состояние
   */
  updateUI(updater: (ui: AppStateData['ui']) => AppStateData['ui']): void {
    const oldState = { ...this._state };
    this._state = {
      ...this._state,
      ui: updater(this._state.ui)
    };
    this.notifySubscribers(oldState);
  }

  /**
   * Добавить уведомление
   */
  addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random()}`,
      timestamp: Date.now()
    };

    this.updateUI(ui => ({
      ...ui,
      notifications: [...ui.notifications, newNotification]
    }));

    // Автоматически удаляем уведомление через указанное время
    if (newNotification.duration) {
      setTimeout(() => {
        this.removeNotification(newNotification.id);
      }, newNotification.duration);
    }
  }

  /**
   * Удалить уведомление
   */
  removeNotification(id: string): void {
    this.updateUI(ui => ({
      ...ui,
      notifications: ui.notifications.filter(n => n.id !== id)
    }));
  }

  /**
   * Обновить состояние (реализация абстрактного метода)
   */
  protected updateState(updater: (state: AppStateData) => AppStateData): void {
    const oldState = { ...this._state };
    this._state = updater(this._state);
    this.notifySubscribers(oldState);
  }
}

/**
 * Глобальный экземпляр store
 */
export const appStore = new AppStore(); 