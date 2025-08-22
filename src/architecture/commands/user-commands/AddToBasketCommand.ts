import { Command } from '../Command';
import { appStore, ProductItem } from '../../state/Store';
import { eventBus } from '../../events/EventBus';

export interface AddToBasketCommandData {
  productId: string;
  product: ProductItem;
}

export class AddToBasketCommand extends Command<AddToBasketCommandData> {
  async execute(): Promise<void> {
    const { productId, product } = this.data;
    
    appStore.updateBasket(basket => {
      const existingItem = basket.items.find(item => item.id === productId);
      
      if (existingItem) {
        return basket;
      }

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

    await eventBus.emit('basket:updated', { productId, action: 'add' }, 'AddToBasketCommand');
    
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
