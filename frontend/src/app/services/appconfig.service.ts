import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface AppConfig {
    disable_authentication: boolean;
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
    private config: AppConfig;
    loaded = false;

    constructor(private http: HttpClient) {}

    loadConfig(): Promise<void> {
        return this.http
            .get<AppConfig>('/assets/fimetis.json')
            .toPromise()
            .then(data => {
                this.config = data;
                this.loaded = true;
            });
    }

    getConfig(): AppConfig {
        return this.config;
    }
}
