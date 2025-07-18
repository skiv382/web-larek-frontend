export class Api {
	constructor(protected baseUrl: string, protected options?: RequestInit) {}

	protected async get(url: string) {
		const res = await fetch(this.baseUrl + url, this.options);
		if (!res.ok) throw new Error('Ошибка запроса');
		return res.json();
	}

	protected async post(url: string, data: any) {
		const res = await fetch(this.baseUrl + url, {
			...this.options,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
		});
		if (!res.ok) throw new Error('Ошибка запроса');
		return res.json();
	}
}

export type ApiListResponse<T> = { items: T[] };
