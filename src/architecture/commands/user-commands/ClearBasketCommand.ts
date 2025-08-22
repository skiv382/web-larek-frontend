import { Command } from '../Command';
import { appStore, BasketItem } from '../../state/Store';
import { eventBus } from '../../events/EventBus';

export interface ClearBasketCommandData {
}

export class ClearBasketCommand extends Command<ClearBasketCommandData> {
  private clearedItems: BasketItem[] = [];
  private clearedTotal: number = 0;

  async execute(): Promise<void> {
    const currentBasket = appStore.getState().basket;
    
    this.clearedItems = [...currentBasket.items];
    this.clearedTotal = currentBasket.total;
    
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
