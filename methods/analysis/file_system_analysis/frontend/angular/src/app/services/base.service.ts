import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {environment} from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BaseService {
    constructor(private http: HttpClient) { }

    getCases() {
        return this.http.get<any>(environment.backendUrl + '/case/all').toPromise();
    }

    getFilters() {
        return this.http.get<any>(environment.backendUrl + '/filter/all').toPromise();
    }
}
