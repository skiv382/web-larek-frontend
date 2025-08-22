/**
 * Новая система событий с middleware и типизацией
 */
export type EventHandler<T = unknown> = (data: T, context: EventContext) => void | Promise<void>;

export interface EventContext {
  timestamp: number;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface EventSubscription {
  id: string;
  eventName: string;
  handler: EventHandler;
  priority: number;
  once: boolean;
}

export interface EventMetadata {
  name: string;
  data: unknown;
  context: EventContext;
  timestamp: number;
}

/**
 * Middleware для обработки событий
 */
export interface EventMiddleware {
  name: string;
  execute(event: EventMetadata, next: () => Promise<void>): Promise<void>;
}

/**
 * Логирование событий
 */
export class LoggingMiddleware implements EventMiddleware {
  name = 'LoggingMiddleware';

  async execute(event: EventMetadata, next: () => Promise<void>): Promise<void> {
    await next();
  }
}

/**
 * Валидация событий
 */
export class ValidationMiddleware implements EventMiddleware {
  name = 'ValidationMiddleware';
  private validators = new Map<string, (data: unknown) => boolean>();

  addValidator(eventName: string, validator: (data: unknown) => boolean): void {
    this.validators.set(eventName, validator);
  }

  async execute(event: EventMetadata, next: () => Promise<void>): Promise<void> {
    const validator = this.validators.get(event.name);
    if (validator && !validator(event.data)) {
      throw new Error(`Валидация события ${event.name} не пройдена`);
    }
    await next();
  }
}

/**
 * Основной EventBus
 */
export class EventBus {
  private handlers = new Map<string, EventSubscription[]>();
  private middleware: EventMiddleware[] = [];
  private subscriptionIdCounter = 0;
  private eventHistory: EventMetadata[] = [];
  private maxHistorySize = 1000;

  constructor() {
    // Добавляем только необходимые middleware
    // Подробное логирование отключено по умолчанию
    // this.addMiddleware(new LoggingMiddleware());
    this.addMiddleware(new ValidationMiddleware());
  }

  /**
   * Добавить middleware
   */
  addMiddleware(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Подписаться на событие
   */
  on<T = unknown>(
    eventName: string, 
    handler: EventHandler<T>, 
    priority = 0
  ): string {
    const id = `event_${++this.subscriptionIdCounter}`;
    const subscription: EventSubscription = {
      id,
      eventName,
      handler,
      priority,
      once: false
    };

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }

    const handlers = this.handlers.get(eventName);
    if (!handlers) return '';
    handlers.push(subscription);
    
    // Сортируем по приоритету (высокий приоритет = низкий номер)
    handlers.sort((a, b) => a.priority - b.priority);

    return id;
  }

  /**
   * Подписаться на событие один раз
   */
  once<T = unknown>(
    eventName: string, 
    handler: EventHandler<T>, 
    priority = 0
  ): string {
    const id = this.on(eventName, handler, priority);
    const subscription = this.handlers.get(eventName)?.find(s => s.id === id);
    if (subscription) {
      subscription.once = true;
    }
    return id;
  }

  /**
   * Отписаться от события
   */
  off(eventName: string, handlerId: string): boolean {
    const handlers = this.handlers.get(eventName);
    if (!handlers) return false;

    const index = handlers.findIndex(h => h.id === handlerId);
    if (index === -1) return false;

    handlers.splice(index, 1);
    
    if (handlers.length === 0) {
      this.handlers.delete(eventName);
    }

    return true;
  }

  /**
   * Отписаться от всех событий
   */
  offAll(eventName?: string): void {
    if (eventName) {
      this.handlers.delete(eventName);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Вызвать событие
   */
  async emit<T = unknown>(
    eventName: string, 
    data: T, 
    source = 'unknown',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const context: EventContext = {
      timestamp: Date.now(),
      source,
      metadata
    };

    const event: EventMetadata = {
      name: eventName,
      data,
      context,
      timestamp: context.timestamp
    };

    // Добавляем в историю
    this.addToHistory(event);

    // Выполняем middleware
    if (process.env.DEVELOPMENT) {
      await this.executeMiddleware(event);
    }
    
    if (!process.env.DEVELOPMENT) {
      const validation = this.middleware.find(m => m.name === 'ValidationMiddleware');
      if (validation) {
        await validation.execute(event, async () => Promise.resolve());
      }
    }

    // Вызываем обработчики
    const handlers = this.handlers.get(eventName);
    if (handlers) {
      const handlersToRemove: string[] = [];

      for (const subscription of handlers) {
        try {
          await subscription.handler(data, context);
          
          if (subscription.once) {
            handlersToRemove.push(subscription.id);
          }
        } catch (error) {
          console.error(`Ошибка в обработчике события ${eventName}:`, error);
        }
      }

      // Удаляем одноразовые обработчики
      handlersToRemove.forEach(id => this.off(eventName, id));
    }
  }

  /**
   * Выполнить middleware
   */
  private async executeMiddleware(event: EventMetadata): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= this.middleware.length) {
        return;
      }

      const middleware = this.middleware[index++];
      await middleware.execute(event, next);
    };

    await next();
  }

  /**
   * Добавить событие в историю
   */
  private addToHistory(event: EventMetadata): void {
    this.eventHistory.push(event);
    
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Получить историю событий
   */
  getEventHistory(): EventMetadata[] {
    return [...this.eventHistory];
  }

  /**
   * Очистить историю событий
   */
  clearEventHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Получить количество подписчиков на событие
   */
  getSubscriberCount(eventName: string): number {
    return this.handlers.get(eventName)?.length || 0;
  }

  /**
   * Получить список всех событий
   */
  getEventNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Глобальный экземпляр EventBus
 */
export const eventBus = new EventBus(); 