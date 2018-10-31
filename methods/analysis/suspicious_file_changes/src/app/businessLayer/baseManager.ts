import {Injectable} from '@angular/core';
import {ElasticsearchService} from '../elasticsearch.service';
import 'rxjs/add/operator/toPromise';
import {BaseDao} from '../dao/baseDao';


@Injectable()
export class BaseManager {

    private baseManagerDao;
    constructor(private es: ElasticsearchService) {
        this.baseManagerDao = new BaseDao(es);
    }

    async getCases(index, type) {
        return this.baseManagerDao.getCases(index, type);
    }

    async getFilters(index, type) {
        return this.baseManagerDao.getFilters(index, type);
    }
}
