/**
 * Главный класс приложения с новой архитектурой
 * Полностью отличается от старого index.ts
 */
import { appStore, BasketItem, ProductItem, Notification } from './state/Store';
import { eventBus } from './events/EventBus';
import { CommandManager } from './commands/Command';
import {
  AddToBasketCommand,
  RemoveFromBasketCommand,
  UpdateOrderFieldCommand,
  OpenModalCommand,
  CloseModalCommand,
  LoadCatalogCommand,
  ClearBasketCommand,
  AddToBasketCommandData,
  RemoveFromBasketCommandData,
  UpdateOrderFieldCommandData,
  OpenModalCommandData,
  ClearBasketCommandData
} from './commands/UserCommands';

/**
 * Главный класс приложения
 */
export class Application {
  private commandManager: CommandManager;
  private isInitialized = false;
  private subscriptions: string[] = [];

  constructor() {
    this.commandManager = new CommandManager();
    this.setupEventHandlers();
  }

  /**
   * Форматирование цены согласно макету
   * Цены от 10 000 отображаются с пробелом, меньше 10 000 - без пробела
   */
  private formatPrice(price: number): string {
    if (price >= 10000) {
      return price.toLocaleString('ru-RU');
    } else {
      return price.toString();
    }
  }

  /**
   * Инициализация приложения
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Приложение уже инициализировано');
      return;
    }

    try {
      // Загружаем каталог
      const loadCommand = new LoadCatalogCommand({ forceRefresh: true });
      await this.commandManager.executeCommand(loadCommand);

      // Подписываемся на изменения состояния
      this.subscribeToStateChanges();

      // Устанавливаем обработчики UI
      this.setupUIHandlers();

      this.isInitialized = true;

      // Уведомляем о готовности
      await eventBus.emit('app:ready', {}, 'Application');

    } catch (error) {
      console.error('Ошибка инициализации приложения:', error);
      throw error;
    }
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventHandlers(): void {
    // Обработчик добавления в корзину
    eventBus.on<AddToBasketCommandData>('product:add-to-basket', async (data) => {
      try {
        const command = new AddToBasketCommand(data);
        await this.commandManager.executeCommand(command);
      } catch (error) {
        console.error('Ошибка добавления в корзину:', error);
        appStore.addNotification({
          type: 'error',
          message: 'Не удалось добавить товар в корзину',
          duration: 5000
        });
      }
    }, 1);

    // Обработчик удаления из корзины
    eventBus.on<RemoveFromBasketCommandData>('product:remove-from-basket', async (data) => {
      try {
        const command = new RemoveFromBasketCommand(data);
        await this.commandManager.executeCommand(command);
      } catch (error) {
        console.error('Ошибка удаления из корзины:', error);
        appStore.addNotification({
          type: 'error',
          message: 'Не удалось удалить товар из корзины',
          duration: 5000
        });
      }
    }, 1);

    // Обработчик очистки корзины
    eventBus.on<ClearBasketCommandData>('basket:clear', async (data) => {
      try {
        const command = new ClearBasketCommand(data);
        await this.commandManager.executeCommand(command);
      } catch (error) {
        console.error('Ошибка очистки корзины:', error);
        appStore.addNotification({
          type: 'error',
          message: 'Не удалось очистить корзину',
          duration: 5000
        });
      }
    }, 1);

    // Обработчик обновления полей заказа
    eventBus.on<UpdateOrderFieldCommandData>('order:field:change', async (data) => {
      try {
        const command = new UpdateOrderFieldCommand(data);
        await this.commandManager.executeCommand(command);
      } catch (error) {
        console.error('Ошибка обновления поля заказа:', error);
      }
    }, 1);

    // Обработчик открытия модального окна
    eventBus.on<OpenModalCommandData>('modal:open', async (data) => {
      try {
        const command = new OpenModalCommand(data);
        await this.commandManager.executeCommand(command);
      } catch (error) {
        console.error('Ошибка открытия модального окна:', error);
      }
    }, 1);

    // Обработчик закрытия модального окна
    eventBus.on('modal:close', async (data) => {
      try {
        const command = new CloseModalCommand(data);
        await this.commandManager.executeCommand(command);
      } catch (error) {
        console.error('Ошибка закрытия модального окна:', error);
      }
    }, 1);

    // Обработчик обновления корзины
    eventBus.on('basket:updated', async () => {
      // Обновляем UI корзины
      this.updateBasketUI();
    }, 2);

    // Обработчик загрузки каталога
    eventBus.on('catalog:loaded', async () => {
      // Обновляем UI каталога
      this.updateCatalogUI();
    }, 2);

    // Обработчик ошибок
    eventBus.on('error', async (data) => {
      console.error('Системная ошибка:', data);
      appStore.addNotification({
        type: 'error',
        message: 'Произошла системная ошибка',
        duration: 10000
      });
    }, 0); // Высокий приоритет для обработки ошибок
  }

  /**
   * Подписка на изменения состояния
   */
  private subscribeToStateChanges(): void {
    // Подписываемся на изменения корзины
    const basketSubscription = appStore.subscribe(
      (newState, oldState) => {
        if (newState.basket.items.length !== oldState.basket.items.length || 
            newState.basket.total !== oldState.basket.total) {
          this.updateBasketUI();
          
          // Если открыто модальное окно превью, обновляем его
          const ui = appStore.getState().ui;
          if (ui.modal.isOpen && ui.modal.content === 'preview') {
            this.showModalContent('preview');
          }
        }
      },
      state => ({ basket: state.basket })
    );

    // Подписываемся на изменения UI
    const uiSubscription = appStore.subscribe(
      (newState, oldState) => {
        // Обновляем модальное окно если изменилось состояние открытия ИЛИ содержимое
        if (newState.ui.modal.isOpen !== oldState.ui.modal.isOpen || 
            newState.ui.modal.content !== oldState.ui.modal.content) {
          this.updateModalState();
        }
        if (newState.ui.notifications.length !== oldState.ui.notifications.length) {
          this.updateNotifications();
        }
      },
      state => ({ ui: state.ui })
    );

    this.subscriptions.push(basketSubscription, uiSubscription);
  }

  /**
   * Настройка обработчиков UI
   */
  private setupUIHandlers(): void {
    // Обработчик клика по кнопке корзины
    const basketButton = document.querySelector('.header__basket') as HTMLElement;
    if (basketButton) {
      basketButton.addEventListener('click', () => {
        eventBus.emit('modal:open', { 
          content: 'basket', 
          modalType: 'basket' 
        }, 'UI');
      });
    }

    // Обработчик закрытия модальных окон
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('modal__close')) {
        eventBus.emit('modal:close', {}, 'UI');
      }
      // Закрытие по клику на оверлей
      if (target.classList.contains('modal')) {
        eventBus.emit('modal:close', {}, 'UI');
      }
    });

    // Обработчик нажатия Escape для закрытия модальных окон
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        eventBus.emit('modal:close', {}, 'UI');
      }
      

    });

    // Динамические обработчики для модальных окон
    this.setupModalHandlers();
  }

  /**
   * Настройка обработчиков модальных окон
   */
  private setupModalHandlers(): void {
    // Обработчики добавляются непосредственно к элементам при создании содержимого модальных окон
  }

  /**
   * Обновление UI корзины
   */
  private updateBasketUI(): void {
    // Обновляем счетчик товаров
    this.updateBasketCounter();
    
    // Обновляем общую сумму
    this.updateBasketTotal();
    
    // Обновляем список товаров
    this.updateBasketItems();
    
    // Если модальное окно корзины открыто, обновляем его содержимое
    const ui = appStore.getState().ui;
    if (ui.modal.isOpen && ui.modal.content === 'basket') {
      this.updateModalState();
    }
  }

  /**
   * Обновление счетчика корзины
   */
  private updateBasketCounter(): void {
    const basket = appStore.getState().basket;
    const counter = document.querySelector('.header__basket-counter') as HTMLElement;
    
    if (counter) {
      counter.textContent = basket.items.length.toString();
      // Счетчик всегда видим и активен
      counter.style.display = 'block';
      counter.style.opacity = '1';
    }
  }

  /**
   * Обновление общей суммы корзины
   */
  private updateBasketTotal(): void {
    const basket = appStore.getState().basket;
    const totalElement = document.querySelector('.basket__price') as HTMLElement;

    if (totalElement) {
      totalElement.textContent = `${basket.total.toLocaleString('ru-RU')} синапсов`;
    }
  }

  /**
   * Обновление списка товаров в корзине
   */
  private updateBasketItems(): void {
    const basket = appStore.getState().basket;
    const basketList = document.querySelector('.basket__list') as HTMLElement;
    
    if (basketList) {
      basketList.innerHTML = '';
      
      basket.items.forEach(item => {
        const itemElement = this.createBasketItemElement(item);
        basketList.appendChild(itemElement);
      });
    }
  }

  /**
   * Создание элемента товара в корзине
   */
  private createBasketItemElement(item: BasketItem): HTMLElement {
    // Используем готовый шаблон из HTML
    const template = document.getElementById('card-basket') as HTMLTemplateElement;
    if (!template) {
      throw new Error('Шаблон card-basket не найден');
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const itemElement = clone.querySelector('.basket__item') as HTMLElement;
    
    if (!itemElement) {
      throw new Error('Элемент .basket__item не найден в шаблоне');
    }

    // Заполняем данные
    const indexElement = itemElement.querySelector('.basket__item-index') as HTMLElement;
    const titleElement = itemElement.querySelector('.card__title') as HTMLElement;
    const priceElement = itemElement.querySelector('.card__price') as HTMLElement;
    const deleteButton = itemElement.querySelector('.basket__item-delete') as HTMLElement;

    if (indexElement) indexElement.textContent = item.index.toString();
    if (titleElement) titleElement.textContent = item.title;
    if (priceElement) priceElement.textContent = `${this.formatPrice(item.price)} синапсов`;

    // Добавляем обработчик удаления
    if (deleteButton) {
      deleteButton.setAttribute('data-id', item.id);
      deleteButton.addEventListener('click', () => {
        eventBus.emit('product:remove-from-basket', { 
          productId: item.id 
        }, 'UI');
      });
    }

    return itemElement;
  }

  /**
   * Обновление UI каталога
   */
  private updateCatalogUI(): void {
    const catalog = appStore.getState().catalog;
    const catalogContainer = document.querySelector('.gallery') as HTMLElement;
    
    if (catalogContainer && catalog.items.length > 0) {
      catalogContainer.innerHTML = '';
      
      catalog.items.forEach(item => {
        const itemElement = this.createCatalogItemElement(item);
        catalogContainer.appendChild(itemElement);
      });
    }
  }

  /**
   * Создание элемента товара в каталоге
   */
  private createCatalogItemElement(item: ProductItem): HTMLElement {
    // Используем готовый шаблон из HTML
    const template = document.getElementById('card-catalog') as HTMLTemplateElement;
    if (!template) {
      throw new Error('Шаблон card-catalog не найден');
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const cardElement = clone.querySelector('.card') as HTMLElement;
    
    if (!cardElement) {
      throw new Error('Элемент .card не найден в шаблоне');
    }

    // Заполняем данные
    const titleElement = cardElement.querySelector('.card__title') as HTMLElement;
    const imageElement = cardElement.querySelector('.card__image') as HTMLImageElement;
    const priceElement = cardElement.querySelector('.card__price') as HTMLElement;
    const categoryElement = cardElement.querySelector('.card__category') as HTMLElement;

    if (titleElement) titleElement.textContent = item.title;
    if (imageElement) {
      imageElement.src = this.getLocalImagePath(item.image);
      imageElement.alt = item.title;
    }
    if (priceElement) {
      priceElement.textContent = item.price ? `${this.formatPrice(item.price)} синапсов` : 'Бесценно';
    }
    if (categoryElement) {
      categoryElement.textContent = item.category;
      // Устанавливаем правильный класс категории
      categoryElement.className = `card__category card__category_${this.getCategoryClass(item.category)}`;
    }

        // Добавляем обработчик клика по карточке (предварительный просмотр)
    cardElement.addEventListener('click', () => {
      eventBus.emit('modal:open', { 
        content: 'preview', 
        modalType: 'preview',
        product: item 
      }, 'UI');
    });

    return cardElement;
  }

  /**
   * Получить CSS класс для категории
   */
  private getCategoryClass(category: string): string {
    const categoryMap: Record<string, string> = {
      'софт-скил': 'soft',
      'хард-скил': 'hard',
      'другое': 'other',
      'дополнительное': 'additional',
      'кнопка': 'button'
    };
    
    return categoryMap[category] || 'other';
  }

  /**
   * Получить локальный путь к изображению
   */
  private getLocalImagePath(serverPath: string): string {
    // Маппинг серверных путей на локальные файлы
    const imageMap: Record<string, string> = {
      'https://larek-api.nomoreparties.co/content/weblarek/5_Dots.svg': require('../images/5_Dots.svg.png'),
      'https://larek-api.nomoreparties.co/content/weblarek/Shell.svg': require('../images/Shell.svg.png'),
      'https://larek-api.nomoreparties.co/content/weblarek/Asterisk_2.svg': require('../images/Asterisk_2.svg.png'),
      'https://larek-api.nomoreparties.co/content/weblarek/Soft_Flower.svg': require('../images/Soft_Flower.svg.png'),
      'https://larek-api.nomoreparties.co/content/weblarek/mute-cat.svg': require('../images/mute-cat.svg.png'),
      'https://larek-api.nomoreparties.co/content/weblarek/Pill.svg': require('../images/Pill.svg.png'),
      'https://larek-api.nomoreparties.co/content/weblarek/Polygon.svg': require('../images/Polygon.svg.png'),
      'https://larek-api.nomoreparties.co/content/weblarek/Butterfly.svg': require('../images/Butterfly.svg.png'),
      'https://larek-api.nomoreparties.co/content/weblarek/Leaf.svg': require('../images/Leaf.svg.png'),
      'https://larek-api.nomoreparties.co/content/weblarek/Mithosis.svg': require('../images/Mithosis.svg.png'),
    };
    
    return imageMap[serverPath] || serverPath;
  }

  /**
   * Обновление состояния модального окна
   */
  private updateModalState(): void {
    const ui = appStore.getState().ui;
    const modal = document.querySelector('.modal') as HTMLElement;
    
    if (modal) {
      if (ui.modal.isOpen) {
        modal.classList.add('modal_active');
        this.showModalContent(ui.modal.content);
        // Прокручиваем модальное окно в видимую область
        modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        modal.classList.remove('modal_active');
        this.hideModalContent();
      }
    }
  }

  /**
   * Показать содержимое модального окна
   */
  private showModalContent(content: string | null): void {
    const modalContent = document.querySelector('.modal__content') as HTMLElement;
    
    if (modalContent && content) {
      switch (content) {
        case 'basket':
          const basketElement = this.getBasketModalContent();
          modalContent.innerHTML = '';
          modalContent.appendChild(basketElement);
          break;
        case 'order':
          const orderElement = this.getOrderModalContent();
          modalContent.innerHTML = '';
          modalContent.appendChild(orderElement);
          break;
        case 'contacts':
          const contactsElement = this.getContactsModalContent();
          modalContent.innerHTML = '';
          modalContent.appendChild(contactsElement);
          break;
        case 'preview':
          const previewElement = this.getPreviewModalContent();
          modalContent.innerHTML = '';
          modalContent.appendChild(previewElement);
          break;
        case 'success':
          const successElement = this.getSuccessModalContent();
          modalContent.innerHTML = '';
          modalContent.appendChild(successElement);
          break;
        default:
          modalContent.innerHTML = '<p>Содержимое не найдено</p>';
      }
    }
  }

  /**
   * Скрыть содержимое модального окна
   */
  private hideModalContent(): void {
    const modalContent = document.querySelector('.modal__content') as HTMLElement;
    if (modalContent) {
      modalContent.innerHTML = '';
    }
  }

  /**
   * Получить содержимое модального окна корзины
   */
  private getBasketModalContent(): HTMLElement {
    const basket = appStore.getState().basket;
    
    // Используем готовый шаблон из HTML
    const template = document.getElementById('basket') as HTMLTemplateElement;
    if (!template) {
      throw new Error('Шаблон basket не найден');
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const basketElement = clone.querySelector('.basket') as HTMLElement;
    
    if (!basketElement) {
      throw new Error('Элемент .basket не найден в шаблоне');
    }

    // Заполняем список товаров
    const basketList = basketElement.querySelector('.basket__list') as HTMLElement;
    if (basketList) {
      basketList.innerHTML = '';
      
      if (basket.items.length > 0) {
        basket.items.forEach(item => {
          const itemElement = this.createBasketItemElement(item);
          basketList.appendChild(itemElement);
        });
      } else {
        // Показываем текст "Корзина пуста" без маркера списка
        basketList.innerHTML = '<span class="basket__empty">Корзина пуста</span>';
      }
    }

    // Обновляем общую сумму
    const totalElement = basketElement.querySelector('.basket__price') as HTMLElement;
    if (totalElement) {
      totalElement.textContent = `${this.formatPrice(basket.total)} синапсов`;
    }

    // Добавляем обработчик к кнопке "Оформить"
    const orderButton = basketElement.querySelector('.basket__button') as HTMLElement;
    if (orderButton) {
      if (basket.items.length > 0) {
        // Кнопка активна только если есть товары в корзине
        orderButton.removeAttribute('disabled');
        orderButton.addEventListener('click', () => {
          eventBus.emit('modal:open', { 
            content: 'order', 
            modalType: 'order' 
          }, 'UI');
        });
      } else {
        // Кнопка неактивна если корзина пуста
        orderButton.setAttribute('disabled', 'disabled');
        orderButton.classList.add('button_disabled');
      }
    }

    return basketElement;
  }

  /**
   * Получить содержимое модального окна заказа
   */
  private getOrderModalContent(): HTMLElement {
    // Используем готовый шаблон из HTML
    const template = document.getElementById('order') as HTMLTemplateElement;
    if (!template) {
      throw new Error('Шаблон order не найден');
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const orderElement = clone.querySelector('.form') as HTMLElement;
    
    if (!orderElement) {
      throw new Error('Элемент .form не найден в шаблоне');
    }

    // Добавляем обработчики к кнопкам вариантов оплаты
    const cardButton = orderElement.querySelector('button[name="card"]') as HTMLElement;
    const cashButton = orderElement.querySelector('button[name="cash"]') as HTMLElement;
    
    // Функция для валидации формы заказа
    const validateOrderForm = () => {
      const paymentSelected = cardButton?.classList.contains('button_alt-active') || 
                             cashButton?.classList.contains('button_alt-active');
      const addressFilled = addressInput?.value.trim().length > 0;
      
      // Получаем элемент для отображения ошибок
      const errorsElement = orderElement.querySelector('.form__errors') as HTMLElement;
      
      // Проверяем валидность и показываем ошибки
      if (!paymentSelected && !addressFilled) {
        if (errorsElement) {
          errorsElement.textContent = 'Необходимо выбрать способ оплаты и указать адрес';
        }
        nextButton?.setAttribute('disabled', 'disabled');
      } else if (!paymentSelected) {
        if (errorsElement) {
          errorsElement.textContent = 'Необходимо выбрать способ оплаты';
        }
        nextButton?.setAttribute('disabled', 'disabled');
      } else if (!addressFilled) {
        if (errorsElement) {
          errorsElement.textContent = 'Необходимо указать адрес';
        }
        nextButton?.setAttribute('disabled', 'disabled');
      } else {
        if (errorsElement) {
          errorsElement.textContent = '';
        }
        nextButton?.removeAttribute('disabled');
      }
    };
    
    if (cardButton) {
      cardButton.addEventListener('click', () => {
        // Убираем активный класс у всех кнопок
        cardButton.classList.remove('button_alt-active');
        cashButton?.classList.remove('button_alt-active');
        
        // Добавляем активный класс к выбранной кнопке
        cardButton.classList.add('button_alt-active');
        
        // Обновляем состояние заказа
        eventBus.emit('order:field:change', { 
          field: 'payment', 
          value: 'card' 
        }, 'UI');
        
        // Проверяем валидность формы
        validateOrderForm();
      });
    }
    
    if (cashButton) {
      cashButton.addEventListener('click', () => {
        // Убираем активный класс у всех кнопок
        cardButton?.classList.remove('button_alt-active');
        cashButton.classList.remove('button_alt-active');
        
        // Добавляем активный класс к выбранной кнопке
        cashButton.classList.add('button_alt-active');
        
        // Обновляем состояние заказа
        eventBus.emit('order:field:change', { 
          field: 'payment', 
          value: 'cash' 
        }, 'UI');
        
        // Проверяем валидность формы
        validateOrderForm();
      });
    }

    // Добавляем обработчик к полю адреса
    const addressInput = orderElement.querySelector('input[name="address"]') as HTMLInputElement;
    if (addressInput) {
      addressInput.addEventListener('input', () => {
        eventBus.emit('order:field:change', { 
          field: 'address', 
          value: addressInput.value 
        }, 'UI');
        
        // Проверяем валидность формы
        validateOrderForm();
      });
    }

    // Добавляем обработчик к кнопке "Далее"
    const nextButton = orderElement.querySelector('.order__button') as HTMLElement;
    
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        eventBus.emit('modal:open', { 
          content: 'contacts', 
          modalType: 'contacts' 
        }, 'UI');
      });
    }

    return orderElement;
  }

  /**
   * Получить содержимое модального окна контактов
   */
  private getContactsModalContent(): HTMLElement {
    // Используем готовый шаблон из HTML
    const template = document.getElementById('contacts') as HTMLTemplateElement;
    if (!template) {
      throw new Error('Шаблон contacts не найден');
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const contactsElement = clone.querySelector('.form') as HTMLElement;
    
    if (!contactsElement) {
      throw new Error('Элемент .form не найден в шаблоне');
    }

    // Добавляем обработчики к полям контактов
    const emailInput = contactsElement.querySelector('input[name="email"]') as HTMLInputElement;
    const phoneInput = contactsElement.querySelector('input[name="phone"]') as HTMLInputElement;
    
    // Функция для валидации формы контактов
    const validateContactsForm = () => {
      const emailFilled = emailInput?.value.trim().length > 0;
      const phoneFilled = phoneInput?.value.trim().length > 0;
      
      // Получаем элемент для отображения ошибок
      const errorsElement = contactsElement.querySelector('.form__errors') as HTMLElement;
      
      // Проверяем валидность и показываем ошибки
      if (!emailFilled && !phoneFilled) {
        if (errorsElement) {
          errorsElement.textContent = 'Необходимо указать email и телефон';
        }
        payButton?.setAttribute('disabled', 'disabled');
      } else if (!emailFilled) {
        if (errorsElement) {
          errorsElement.textContent = 'Необходимо указать email';
        }
        payButton?.setAttribute('disabled', 'disabled');
      } else if (!phoneFilled) {
        if (errorsElement) {
          errorsElement.textContent = 'Необходимо указать телефон';
        }
        payButton?.setAttribute('disabled', 'disabled');
      } else {
        if (errorsElement) {
          errorsElement.textContent = '';
        }
        payButton?.removeAttribute('disabled');
      }
    };
    
    if (emailInput) {
      emailInput.addEventListener('input', () => {
        eventBus.emit('order:field:change', { 
          field: 'email', 
          value: emailInput.value 
        }, 'UI');
        
        // Проверяем валидность формы
        validateContactsForm();
      });
    }
    
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        eventBus.emit('order:field:change', { 
          field: 'phone', 
          value: phoneInput.value 
        }, 'UI');
        
        // Проверяем валидность формы
        validateContactsForm();
      });
    }

    // Добавляем обработчик к кнопке "Оплатить"
    const payButton = contactsElement.querySelector('button[type="submit"]') as HTMLElement;
    if (payButton) {
      payButton.addEventListener('click', () => {
        // Сохраняем сумму заказа перед очисткой корзины
        const basket = appStore.getState().basket;
        appStore.updateOrder(order => ({
          ...order,
          lastOrderTotal: basket.total
        }));
        
        // Очищаем корзину сразу после оформления заказа
        eventBus.emit('basket:clear', {}, 'UI');
        
        // Открываем модальное окно успешного заказа
        eventBus.emit('modal:open', { 
          content: 'success', 
          modalType: 'success' 
        }, 'UI');
      });
    }

    return contactsElement;
  }

  /**
   * Получить содержимое модального окна успешного заказа
   */
  private getSuccessModalContent(): HTMLElement {
    // Используем готовый шаблон из HTML
    const template = document.getElementById('success') as HTMLTemplateElement;
    if (!template) {
      throw new Error('Шаблон success не найден');
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const successElement = clone.querySelector('.order-success') as HTMLElement;
    
    if (!successElement) {
      throw new Error('Элемент .order-success не найден в шаблоне');
    }

    // Заполняем данные успешного заказа
    const titleElement = successElement.querySelector('.order-success__title') as HTMLElement;
    const descriptionElement = successElement.querySelector('.order-success__description') as HTMLElement;
    
    if (titleElement) {
      titleElement.textContent = 'Заказ оформлен';
    }
    
    if (descriptionElement) {
      // Используем сохраненную сумму заказа
      const order = appStore.getState().order;
      descriptionElement.textContent = `Списано ${this.formatPrice(order.lastOrderTotal)} синапсов`;
    }

    // Добавляем обработчик к кнопке "За новыми покупками!"
    const closeButton = successElement.querySelector('.order-success__close') as HTMLElement;
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        // Закрываем модальное окно
        eventBus.emit('modal:close', {}, 'UI');
      });
    }

    return successElement;
  }

  /**
   * Получить содержимое модального окна предварительного просмотра
   */
  private getPreviewModalContent(): HTMLElement {
    // Используем готовый шаблон из HTML
    const template = document.getElementById('card-preview') as HTMLTemplateElement;
    if (!template) {
      throw new Error('Шаблон card-preview не найден');
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const previewElement = clone.querySelector('.card') as HTMLElement;
    
    if (!previewElement) {
      throw new Error('Элемент .card не найден в шаблоне');
    }

    // Получаем данные о товаре из состояния
    const ui = appStore.getState().ui;
    const product = ui.modal.product;
    
    if (product) {
      // Заполняем данные
      const titleElement = previewElement.querySelector('.card__title') as HTMLElement;
      const imageElement = previewElement.querySelector('.card__image') as HTMLImageElement;
      const priceElement = previewElement.querySelector('.card__price') as HTMLElement;
      const categoryElement = previewElement.querySelector('.card__category') as HTMLElement;
      const textElement = previewElement.querySelector('.card__text') as HTMLElement;
      const buttonElement = previewElement.querySelector('.card__button') as HTMLElement;

      if (titleElement) titleElement.textContent = product.title;
      if (imageElement) {
        imageElement.src = this.getLocalImagePath(product.image);
        imageElement.alt = product.title;
      }
      if (priceElement) {
        priceElement.textContent = product.price ? `${this.formatPrice(product.price)} синапсов` : 'Бесценно';
      }
      if (categoryElement) {
        categoryElement.textContent = product.category;
        categoryElement.className = `card__category card__category_${this.getCategoryClass(product.category)}`;
      }
      if (textElement) textElement.textContent = product.description || '';
      if (buttonElement) {
        // Очищаем предыдущие обработчики
        const newButton = buttonElement.cloneNode(true) as HTMLElement;
        buttonElement.parentNode?.replaceChild(newButton, buttonElement);
        
        // Проверяем, есть ли товар в корзине
        const basket = appStore.getState().basket;
        const isInBasket = basket.items.some(item => item.id === product.id);
        
        if (!product.price) {
          // Если товар "Бесценно"
          newButton.textContent = 'Недоступно';
          (newButton as HTMLButtonElement).disabled = true;
          newButton.classList.add('button_disabled');
        } else if (isInBasket) {
          // Если товар уже в корзине
          newButton.textContent = 'Удалить из корзины';
          newButton.addEventListener('click', () => {
            eventBus.emit('product:remove-from-basket', { 
              productId: product.id 
            }, 'UI');
          });
        } else {
          // Если товар не в корзине
          newButton.textContent = 'Купить';
          newButton.addEventListener('click', () => {
            eventBus.emit('product:add-to-basket', { 
              productId: product.id, 
              product: product 
            }, 'UI');
          });
        }
      }
    }

    return previewElement;
  }

  /**
   * Обновление уведомлений
   */
  private updateNotifications(): void {
    const notifications = appStore.getState().ui.notifications;
    const notificationsContainer = document.querySelector('.notifications') as HTMLElement;
    
    if (!notificationsContainer) {
      // Создаем контейнер для уведомлений, если его нет
      const container = document.createElement('div');
      container.className = 'notifications';
      document.body.appendChild(container);
    }

    const container = document.querySelector('.notifications') as HTMLElement;
    container.innerHTML = '';

    notifications.forEach(notification => {
      const notificationElement = this.createNotificationElement(notification);
      container.appendChild(notificationElement);
    });
  }

  /**
   * Создание элемента уведомления
   */
  private createNotificationElement(notification: Notification): HTMLElement {
    const element = document.createElement('div');
    element.className = `notification notification--${notification.type}`;
    element.innerHTML = `
      <span class="notification__message">${notification.message}</span>
      <button class="notification__close">&times;</button>
    `;

    // Добавляем обработчик закрытия
    const closeButton = element.querySelector('.notification__close') as HTMLElement;
    closeButton.addEventListener('click', () => {
      appStore.removeNotification(notification.id);
    });

    return element;
  }

  /**
   * Получить состояние приложения
   */
  getState() {
    return appStore.getState();
  }

  /**
   * Получить менеджер команд
   */
  getCommandManager() {
    return this.commandManager;
  }

  /**
   * Получить event bus
   */
  getEventBus() {
    return eventBus;
  }

  /**
   * Очистка ресурсов
   */
  destroy(): void {
    // Отписываемся от всех событий
    this.subscriptions.forEach(id => {
      appStore.unsubscribe(id);
    });

    // Очищаем историю команд
    this.commandManager.clearHistory();

    // Очищаем историю событий
    eventBus.clearEventHistory();

    this.isInitialized = false;
  }
}

/**
 * Глобальный экземпляр приложения
 */
export const app = new Application(); 