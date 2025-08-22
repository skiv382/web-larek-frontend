import { Command } from '../Command';
import { appStore, BasketItem } from '../../state/Store';
import { eventBus } from '../../events/EventBus';

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

    appStore.updateBasket(basket => {
      const filteredItems = basket.items.filter(item => item.id !== productId);
      const updatedItems = filteredItems.map((item, index) => ({
        ...item,
        index: index + 1
      }));

      return {
        ...basket,
        items: updatedItems,
        total: basket.total - this.removedItem.price
      };
    });

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

    appStore.updateBasket(basket => {
      const newItems = [...basket.items, {
        ...this.removedItem,
        index: basket.items.length + 1
      }];

      return {
        ...basket,
        items: newItems,
        total: basket.total + this.removedItem.price
      };
    });

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
