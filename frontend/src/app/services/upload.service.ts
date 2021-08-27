import { Injectable } from '@angular/core';
import {HttpClient, HttpParams, HttpRequest} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {FilterModel} from '../models/filter.model';

@Injectable({ providedIn: 'root' })
export class UploadService {
    constructor(private http: HttpClient) { }

    upload(formData) {
        const request = new HttpRequest<FormData>('POST', environment.backendLocation + '/upload', formData, {
            reportProgress: true
        });
        return this.http.request(request);
        // return this.http.get<any>(environment.backendUrl + '/case/all').toPromise();
    }
}
