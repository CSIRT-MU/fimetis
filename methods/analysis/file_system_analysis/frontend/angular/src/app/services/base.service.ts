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

    getFilterByName(name: string) {
        return this.http.post<any>(environment.backendUrl + '/filter/name', {'name': name}).toPromise().then(response => {
            return response.hits.hits[0]._source;
        });
    }

    buildAdditionSearchFilter(searchString: string) {
        let search = searchString
            .replace('/', '\\\\/')
            .replace('.', '\\\\.')
            .replace('-', '\\\\-')
            .replace('(', '\\\\(')
            .replace(')', '\\\\)')
            .replace('[', '\\\\[')
            .replace(']', '\\\\]')
            .replace('*', '\\\\*')
            .replace('+', '\\\\+')
            .replace('{', '\\\\{')
            .replace('}', '\\\\}')
            .replace('^', '\\\\^')
            .replace('?', '\\\\?')
            .replace('<', '\\\\<')
            .replace('>', '\\\\>')
            .replace('&', '\\\\&')
            .replace('$', '\\\\$')
            .replace('|', '\\\\|');
        search = '.*' + search + '.*';
        console.log('search string:', search);
        return '{"regexp": {' +
            '"File Name.keyword": "' + search + '"' +
            '}}';
    }

    buildAdditionRangeFilter(from: string, to: string) {
        let filter = '{"range": {' +
            '"@timestamp": {';
        if (from != null && from !== undefined) {
            filter += '"gte": "' + from + '",';
        }
        if (to != null && to !== undefined) {
            filter += '"lte": "' + to + '",';
        }
        filter += '"format": "date_time"';
        filter += '}' +
            '}' +
            '}';
        return filter;
    }

    buildAdditionMactimeTypeFilter(mactimes: string[]) {

        let filter = '{"bool": {' +
            '"should": [';
        for (let index = 0; index < mactimes.length; index++) {
            filter += '{"wildcard":';
            filter += '{';
            filter += '"Type.keyword":"*' + mactimes[index] + '*"';
            filter += '}';
            filter += '}';

            if (index < (mactimes.length - 1)) {
                filter += ',';
            }
        }
        filter += ']}}';

        return filter;
    }
}
