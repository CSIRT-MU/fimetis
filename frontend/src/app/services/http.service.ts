import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable()
export class HTTPService {

    constructor(private http: HttpClient) {
    }

    post(path: string, body: any)  {
        return this.http.post<any>(environment.backendLocation + path, body);
    }

    get(path: string) {
        return this.http.get<any>(environment.backendLocation + path);
    }

    delete(path:string) {
        return this.http.delete(environment.backendLocation + path);
    }

}
