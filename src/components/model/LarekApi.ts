import {
	ILarekAPI,
	IOrder,
	IOrderResult,
	IProductItem,
} from '../../types/index';
import { Api, ApiListResponse } from '../base/api';

export class LarekAPI extends Api implements ILarekAPI {
	readonly cdn: string;

	constructor(cdn: string, baseUrl: string, options?: RequestInit) {
		super(baseUrl, options);
		this.cdn = cdn;
	}

	async getItems(): Promise<IProductItem[]> {
		try {
			const response = await this.get('/product');
			const data = response as ApiListResponse<IProductItem>;
			return data.items.map((item: IProductItem) => ({
				...item,
				image: this.cdn + item.image,
			}));
		} catch (error) {
			throw new Error('Ошибка получения данных');
		}
	}

	async orderItems(order: IOrder): Promise<IOrderResult> {
		try {
			return (await this.post('/order', order)) as IOrderResult;
		} catch (error) {
			throw new Error('Ошибка отправки данных');
		}
	}
}
