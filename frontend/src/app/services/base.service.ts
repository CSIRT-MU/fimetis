import { Injectable } from '@angular/core';
import {FilterModel} from '../models/filter.model';
import { HTTPService } from './http.service';

@Injectable({ providedIn: 'root' })
export class BaseService {
    constructor(private http: HTTPService) { }

    getAccessibleCases() {
        return this.http.get('/case/accessible').toPromise();
    }

    getAdministratedCases() {
        return this.http.get('/case/administrated').toPromise();
    }

    getAllUsers() {
        return this.http.get('/user/all').toPromise();
    }

    getAllGroups() {
        return this.http.get('/group/all').toPromise();
    }

    getAllInternalGroups() {
        return this.http.get('/group/internal/all').toPromise();
    }
    
    addUser(login, password, name, email) {
        return this.http.post('/user/add',
            {'login': login, 'password': password, 'name': name, 'email': email }).toPromise();
    }

    addGroup(name, role) {
        return this.http.post('/group/add', {'name': name, 'role': role}).toPromise();
    }

    getUserIdsWithAccessToCase(case_id, access_type) {
        let role = '';
        if (access_type === 'full-access') {
            role = 'admin';
        } else {
            role = 'user';
        }

        return this.http.get('/case/' + case_id + '/access/' + role).toPromise();
    }

    getGroupIdsWithAccessToCase(case_id) {
        return this.http.get('/case/' + case_id + '/access/groups').toPromise();
    }

    getUsersInGroup(group_id) {
        return this.http.get('/group/' + group_id + '/users').toPromise();
    }

    manageAccessForManyUsersToCase(case_id, access_type, usersToAdd, usersToDel) {
        let role = '';
        if (access_type === 'full-access') {
            role = 'admin';
        } else {
            role = 'user';
        }

        return this.http.post('/case/' + case_id + '/access/' + role + '/manage',
            {'user_ids_to_add' : usersToAdd, 'user_ids_to_del' : usersToDel}).toPromise();
    }

    manageAccessForManyGroupsToCase(case_id, groupsToAdd, groupsToDel) {
        return this.http.post('/case/' + case_id + '/access/group/manage',
            {'group_ids_to_add' : groupsToAdd, 'group_ids_to_del' : groupsToDel}).toPromise();
    }

    manageUsersInGroup(group_id, usersToAdd, usersToDel) {
        return this.http.post('/group/users/manage',
            {'group_id': group_id, 'user_ids_to_add': usersToAdd, 'user_ids_to_del': usersToDel}).toPromise();

    }

    getAvailableUsersToAdd(case_id) {
        return this.http.post('/user/available', {'case_id': case_id}).toPromise();
    }

    addUserAccessToCase(case_id, login, role) {
        return this.http.post('/case/add-user', {'case_id': case_id, 'user_login': login, 'role': role}).toPromise();
    }

    deleteUserAccessToCase(case_id, login) {
        return this.http.post('/case/delete-user', {'case_id': case_id, 'user_login': login}).toPromise();
    }

    updateCaseDescription(case_id, description) {
        return this.http.post('/case/update-description', {'case_id': case_id, 'description': description}).toPromise();
    }

    async getNoteForCase(case_name) {
        return this.http.post('/case/note', {'case_name': case_name}).toPromise();
    }

    updateNoteForCase(case_name, updated_note) {
        return this.http.post('/case/note/update', {'case_name': case_name, 'updated_note': updated_note}).toPromise();
    }
    getFilters() {
        return this.http.get('/filter/all').toPromise();
    }

    getFilterByName(name: string) {
        return this.http.post('/filter/name', {'name': name}).toPromise().then(response => {
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

    loadFiltersFromDatabase() {
        return this.http.get('/filter-db/all').toPromise().then(
            response => {
                return response;
            }, error => {
                console.error(error);
                return error;
            });
    }

    deleteCase(_case: string) {
        return this.http.delete('/case/delete/' + _case).toPromise();
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
