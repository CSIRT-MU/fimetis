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

    async getCases() {
        return this.baseManagerDao.getCases();
    }

    async getFilters() {
        return this.baseManagerDao.getFilters();
    }

    async getFirstAndLast(_case, _clusters, _additionalFilters) {
        const first = await this.baseManagerDao.getFirstOrLast(_case, _clusters, _additionalFilters, 'asc');
        const last = await this.baseManagerDao.getFirstOrLast(_case, _clusters, _additionalFilters, 'desc');
        return [first, last];
    }
}
