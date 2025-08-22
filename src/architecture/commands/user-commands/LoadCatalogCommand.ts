import { Command } from '../Command';
import { appStore, ProductItem } from '../../state/Store';
import { eventBus } from '../../events/EventBus';

export interface LoadCatalogCommandData {
  forceRefresh?: boolean;
}

export class LoadCatalogCommand extends Command<LoadCatalogCommandData> {
  async execute(): Promise<void> {
    const { forceRefresh = false } = this.data;
    
    const currentState = appStore.getState().catalog;
    if (!forceRefresh && currentState.items.length > 0 && !currentState.loading) {
      return;
    }

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
