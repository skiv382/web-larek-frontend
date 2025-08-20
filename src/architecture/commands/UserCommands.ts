/**
 * Конкретные команды для действий пользователя
 * Каждая команда - отдельный класс с логикой выполнения
 */
import { Command } from './Command';
import { appStore, ProductItem, BasketItem } from '../state/Store';
import { eventBus } from '../events/EventBus';
import { SimpleValidationEngine } from '../validators/SimpleValidationEngine';

// ===== КОМАНДЫ КАТАЛОГА =====

export interface AddToBasketCommandData {
  productId: string;
  product: ProductItem;
}

export class AddToBasketCommand extends Command<AddToBasketCommandData> {
  async execute(): Promise<void> {
    const { productId, product } = this.data;
    
    // Обновляем состояние корзины
    appStore.updateBasket(basket => {
      const existingItem = basket.items.find(item => item.id === productId);
      
      if (existingItem) {
        // Товар уже в корзине - ничего не делаем
        return basket;
      }

      // Добавляем новый товар
      const newItem = {
        id: productId,
        index: basket.items.length + 1,
        title: product.title,
        price: product.price || 0
      };

      return {
        ...basket,
        items: [...basket.items, newItem],
        total: basket.total + (product.price || 0)
      };
    });

    // Уведомляем о изменении корзины
    await eventBus.emit('basket:updated', { productId, action: 'add' }, 'AddToBasketCommand');
    
    // Показываем уведомление
    appStore.addNotification({
      type: 'success',
      message: `Товар "${product.title}" добавлен в корзину`,
      duration: 3000
    });

    this.executed = true;
  }

  async undo(): Promise<void> {
    const { productId } = this.data;
    
    appStore.updateBasket(basket => {
      const item = basket.items.find(item => item.id === productId);
      if (!item) return basket;

      return {
        ...basket,
        items: basket.items.filter(item => item.id !== productId),
        total: basket.total - item.price
      };
    });

    await eventBus.emit('basket:updated', { productId, action: 'remove' }, 'AddToBasketCommand');
    
    this.executed = false;
  }

  canExecute(): boolean {
    return !this.executed && !!this.data.productId && !!this.data.product;
  }

  getDescription(): string {
    return `Добавить товар "${this.data.product?.title}" в корзину`;
  }
}

export interface RemoveFromBasketCommandData {
  productId: string;
}

export class RemoveFromBasketCommand extends Command<RemoveFromBasketCommandData> {
  private removedItem: BasketItem | null = null;

  async execute(): Promise<void> {
    const { productId } = this.data;
    
    const currentBasket = appStore.getState().basket;
    this.removedItem = currentBasket.items.find(item => item.id === productId);
    
    if (!this.removedItem) {
      throw new Error(`Товар с ID ${productId} не найден в корзине`);
    }

    appStore.updateBasket(basket => ({
      ...basket,
      items: basket.items.filter(item => item.id !== productId),
      total: basket.total - this.removedItem.price
    }));

    await eventBus.emit('basket:updated', { productId, action: 'remove' }, 'RemoveFromBasketCommand');
    
    appStore.addNotification({
      type: 'info',
      message: `Товар "${this.removedItem.title}" удален из корзины`,
      duration: 3000
    });

    this.executed = true;
  }

  async undo(): Promise<void> {
    if (!this.removedItem) return;

    appStore.updateBasket(basket => ({
      ...basket,
      items: [...basket.items, this.removedItem],
      total: basket.total + this.removedItem.price
    }));

    await eventBus.emit('basket:updated', { 
      productId: this.removedItem.id, 
      action: 'add' 
    }, 'RemoveFromBasketCommand');

    this.executed = false;
  }

  canExecute(): boolean {
    return !this.executed && !!this.data.productId;
  }

  getDescription(): string {
    return `Удалить товар из корзины`;
  }
}

// ===== КОМАНДА ОЧИСТКИ КОРЗИНЫ =====

export interface ClearBasketCommandData {
  // Пустой интерфейс, так как команда не требует дополнительных данных
}

export class ClearBasketCommand extends Command<ClearBasketCommandData> {
  private clearedItems: BasketItem[] = [];
  private clearedTotal: number = 0;

  async execute(): Promise<void> {
    const currentBasket = appStore.getState().basket;
    
    // Сохраняем данные для отмены
    this.clearedItems = [...currentBasket.items];
    this.clearedTotal = currentBasket.total;
    
    // Очищаем корзину
    appStore.updateBasket(basket => ({
      ...basket,
      items: [],
      total: 0
    }));

    await eventBus.emit('basket:cleared', {}, 'ClearBasketCommand');
    
    appStore.addNotification({
      type: 'info',
      message: 'Корзина очищена',
      duration: 3000
    });

    this.executed = true;
  }

  async undo(): Promise<void> {
    if (this.clearedItems.length === 0) return;

    // Восстанавливаем корзину
    appStore.updateBasket(basket => ({
      ...basket,
      items: [...this.clearedItems],
      total: this.clearedTotal
    }));

    await eventBus.emit('basket:restored', {}, 'ClearBasketCommand');
    
    this.executed = false;
  }

  canExecute(): boolean {
    return !this.executed;
  }

  getDescription(): string {
    return 'Очистить корзину';
  }
}

// ===== КОМАНДЫ ЗАКАЗА =====

export interface UpdateOrderFieldCommandData {
  field: 'payment' | 'address' | 'email' | 'phone';
  value: string;
}

export class UpdateOrderFieldCommand extends Command<UpdateOrderFieldCommandData> {
  private oldValue = '';

  async execute(): Promise<void> {
    const { field, value } = this.data;
    
    // Сохраняем старое значение для отмены
    this.oldValue = appStore.getState().order[field];
    
    // Обновляем поле заказа
    appStore.updateOrder(order => ({
      ...order,
      [field]: value,
      validation: {
        ...order.validation,
        [field]: '' // Сбрасываем ошибку валидации
      }
    }));

    // Валидируем поле
    let validationError = '';
    
    if (field === 'email') {
      const result = SimpleValidationEngine.validateEmail(value);
      if (!result.isValid) {
        validationError = result.errors.join('; ');
      }
    } else if (field === 'phone') {
      const result = SimpleValidationEngine.validatePhone(value);
      if (!result.isValid) {
        validationError = result.errors.join('; ');
      }
    } else if (field === 'address') {
      const result = SimpleValidationEngine.validateAddress(value);
      if (!result.isValid) {
        validationError = result.errors.join('; ');
      }
    } else if (field === 'payment') {
      const result = SimpleValidationEngine.validatePayment(value);
      if (!result.isValid) {
        validationError = result.errors.join('; ');
      }
    }
    
    if (validationError) {
      appStore.updateOrder(order => ({
        ...order,
        validation: {
          ...order.validation,
          [field]: validationError
        }
      }));
    }

    await eventBus.emit('order:field:updated', { field, value }, 'UpdateOrderFieldCommand');
    
    this.executed = true;
  }

  async undo(): Promise<void> {
    const { field } = this.data;
    
    appStore.updateOrder(order => ({
      ...order,
      [field]: this.oldValue,
      validation: {
        ...order.validation,
        [field]: ''
      }
    }));

    await eventBus.emit('order:field:updated', { 
      field, 
      value: this.oldValue 
    }, 'UpdateOrderFieldCommand');

    this.executed = false;
  }

  canExecute(): boolean {
    return !this.executed && !!this.data.field && this.data.value !== undefined;
  }

  getDescription(): string {
    return `Обновить поле заказа: ${this.data.field}`;
  }
}

// ===== КОМАНДЫ UI =====

export interface OpenModalCommandData {
  content: string;
  modalType?: 'order' | 'contacts' | 'success' | 'preview' | 'basket';
  product?: ProductItem;
}

export class OpenModalCommand extends Command<OpenModalCommandData> {
  async execute(): Promise<void> {
    const { content, modalType, product } = this.data;
    
    // Используем content или modalType для определения типа содержимого
    const modalContent = content || modalType || 'default';
    
    appStore.updateUI(ui => ({
      ...ui,
      modal: {
        isOpen: true,
        content: modalContent,
        product: product || null
      }
    }));

    await eventBus.emit('modal:opened', { content, modalType, product }, 'OpenModalCommand');
    
    this.executed = true;
  }

  async undo(): Promise<void> {
    appStore.updateUI(ui => ({
      ...ui,
      modal: {
        isOpen: false,
        content: null,
        product: null
      }
    }));

    await eventBus.emit('modal:closed', {}, 'OpenModalCommand');
    
    this.executed = false;
  }

  canExecute(): boolean {
    return !this.executed && !!this.data.content;
  }

  getDescription(): string {
    return `Открыть модальное окно: ${this.data.modalType || 'default'}`;
  }
}

export interface CloseModalCommandData {
  modalType?: string;
}

export class CloseModalCommand extends Command<CloseModalCommandData> {
  async execute(): Promise<void> {
    appStore.updateUI(ui => ({
      ...ui,
      modal: {
        isOpen: false,
        content: null,
        product: null
      }
    }));

    await eventBus.emit('modal:closed', {}, 'CloseModalCommand');
    
    this.executed = true;
  }

  async undo(): Promise<void> {
    // Для простоты возвращаем к последнему состоянию
    appStore.updateUI(ui => ({
      ...ui,
      modal: {
        isOpen: true,
        content: 'default',
        product: null
      }
    }));

    await eventBus.emit('modal:opened', { content: 'default' }, 'CloseModalCommand');
    
    this.executed = false;
  }

  canExecute(): boolean {
    return !this.executed;
  }

  getDescription(): string {
    return 'Закрыть модальное окно';
  }
}

// ===== КОМАНДЫ КАТАЛОГА =====

export interface LoadCatalogCommandData {
  forceRefresh?: boolean;
}

export class LoadCatalogCommand extends Command<LoadCatalogCommandData> {
  async execute(): Promise<void> {
    const { forceRefresh = false } = this.data;
    
    // Проверяем, нужно ли загружать каталог
    const currentState = appStore.getState().catalog;
    if (!forceRefresh && currentState.items.length > 0 && !currentState.loading) {
      return;
    }

    // Устанавливаем состояние загрузки
    appStore.updateCatalog(catalog => ({
      ...catalog,
      loading: true,
      error: null
    }));

    try {
      const API_URL = `${process.env.API_ORIGIN || 'https://larek-api.nomoreparties.co'}/api/weblarek`;
      const url = `${API_URL}/product`;
      
      const res = await fetch(url, { 
        headers: { Accept: 'application/json' }, 
        mode: 'cors' 
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const raw = await res.json();
      const items: ProductItem[] = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
      
      if (!items.length) {
        throw new Error('Сервер вернул пустой список товаров');
      }
      
      const CDN_URL = `${process.env.API_ORIGIN || 'https://larek-api.nomoreparties.co'}/content/weblarek`;
      const itemsWithCorrectImages = items.map(item => ({
        ...item,
        image: item.image.startsWith('http') ? item.image : `${CDN_URL}${item.image}`
      }));

      appStore.updateCatalog(catalog => ({
        ...catalog,
        items: itemsWithCorrectImages,
        loading: false,
        error: null
      }));

      await eventBus.emit('catalog:loaded', { items: itemsWithCorrectImages }, 'LoadCatalogCommand');



    } catch (error) {
      appStore.updateCatalog(catalog => ({
        ...catalog,
        loading: false,
        error: 'Ошибка загрузки каталога'
      }));

      await eventBus.emit('catalog:error', { error: 'Ошибка загрузки' }, 'LoadCatalogCommand');
      
      appStore.addNotification({
        type: 'error',
        message: 'Ошибка загрузки каталога',
        duration: 5000
      });
    }

    this.executed = true;
  }

  async undo(): Promise<void> {
    // Откат загрузки каталога - возвращаем предыдущее состояние
    appStore.updateCatalog(catalog => ({
      ...catalog,
      items: [],
      loading: false,
      error: null
    }));

    await eventBus.emit('catalog:cleared', {}, 'LoadCatalogCommand');
    
    this.executed = false;
  }

  canExecute(): boolean {
    return !this.executed;
  }

  getDescription(): string {
    return 'Загрузить каталог товаров';
  }
}

 