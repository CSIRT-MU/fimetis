import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {FilterModel} from '../models/filter.model';
@Injectable({ providedIn: 'root' })
export class BaseService {
    constructor(private http: HttpClient) { }

    getAccessibleCases() {
        return this.http.get<any>(environment.backendUrl + '/case/accessible').toPromise();
    }

    getAdministratedCases() {
        return this.http.get<any>(environment.backendUrl + '/case/administrated').toPromise();
    }

    getAvailableUsersToAdd(case_id) {
        return this.http.post<any>(environment.backendUrl + '/user/available', {'case_id': case_id}).toPromise();
    }

    addUserAccessToCase(case_id, login, role) {
        return this.http.post<any>(
            environment.backendUrl + '/case/add-user', {'case_id': case_id, 'user_login': login, 'role': role}
            ).toPromise();
    }

    deleteUserAccessToCase(case_id, login) {
        return this.http.post<any>(
            environment.backendUrl + '/case/delete-user', {'case_id': case_id, 'user_login': login}
            ).toPromise();
    }

    updateCaseDescription(case_id, description) {
        return this.http.post<any>(
            environment.backendUrl + '/case/update-description', {'case_id': case_id, 'description': description}
            ).toPromise();
    }

    async getNoteForCase(case_name) {
        return this.http.post<any>(
            environment.backendUrl + '/case/note', {'case_name': case_name}
        ).toPromise();
    }

    updateNoteForCase(case_name, updated_note) {
        return this.http.post<any>(
            environment.backendUrl + '/case/note/update', {'case_name': case_name, 'updated_note': updated_note}
        ).toPromise();
    }
    getFilters() {
        return this.http.get<any>(environment.backendUrl + '/filter/all').toPromise();
    }

    getFilterByName(name: string) {
        return this.http.post<any>(environment.backendUrl + '/filter/name', {'name': name}).toPromise().then(response => {
            const filter = new FilterModel();
            filter.name = response.name;
            filter.json = response.json;
            filter.type = response.type;
            filter.params = [];
            try {
                filter.params = JSON.parse(response.params);
            } catch (e) {}
            return filter;
        });
    }

    deleteCase(_case: string) {
        return this.http.delete(environment.backendUrl + '/case/delete/' + _case).toPromise();
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
        return '{"regexp": {' +
            '"File Name.keyword": "' + search + '"' +
            '}}';
    }

    buildAdditionModeFilter(searchString: string) {
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
            '"Mode.keyword": "' + search + '"' +
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

    getDateWithoutOffset(dateToConvert: Date) {
        return new Date(new Date(dateToConvert).getTime() - new Date(dateToConvert).getTimezoneOffset() * 60000);
    }
}
