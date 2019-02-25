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

    /**
     * Loads cases from database
     * @return Array of cases
     */
    async getCases() {
        return this.baseManagerDao.getCases();
    }

    /**
     * Loads filter from database
     * @return Array of filters
     */
    async getFilters() {
        return this.baseManagerDao.getFilters();
    }

    /**
     * Loads the filter by given name
     * @param filter_name Name of the filter in database
     * @return Founded filter
     */
    async getFilterByName(filter_name) {
        return this.baseManagerDao.getFilterByName(filter_name);
    }

    /**
     * Returns first or last entry from given clusters
     * Used for counting the frequency for displaying graph
     *
     * @param _case Name of the case
     * @param _clusters Clusters from those get the first or last entry
     * @param _additional_filters Optional filters
     * @return Array with two elements, first is first entry, second is last entry
     */
    async getFirstAndLast(_case, _clusters, _additionalFilters) {
        const first = await this.baseManagerDao.getFirstOrLast(_case, _clusters, _additionalFilters, 'asc');
        const last = await this.baseManagerDao.getFirstOrLast(_case, _clusters, _additionalFilters, 'desc');
        return [first, last];
    }
}
