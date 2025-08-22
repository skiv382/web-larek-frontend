import { Command } from '../Command';
import { appStore, ProductItem } from '../../state/Store';
import { eventBus } from '../../events/EventBus';

export interface OpenModalCommandData {
  content: string;
  modalType?: 'order' | 'contacts' | 'success' | 'preview' | 'basket';
  product?: ProductItem;
}

export class OpenModalCommand extends Command<OpenModalCommandData> {
  async execute(): Promise<void> {
    const { content, modalType, product } = this.data;
    
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
