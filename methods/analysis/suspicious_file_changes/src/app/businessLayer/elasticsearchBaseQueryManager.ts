import {ComputationModel} from '../models/computation.model';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';
import {ClusterSelectMode} from '../models/cluster.model';
import {ElasticsearchService} from '../elasticsearch.service';
import {Injectable} from '@angular/core';
import {ElasticsearchBaseQueryDao} from '../dao/elasticsearchBaseQueryDao';

@Injectable()
export class ElasticsearchBaseQueryManager {

    private elasticsearchBaseQueryManagerDao;

    constructor() {
        this.elasticsearchBaseQueryManagerDao = new ElasticsearchBaseQueryDao();
    }

    getBaseQueryString(case_name, clusters, additional_filters, graph_filter) {
        return this.elasticsearchBaseQueryManagerDao.getBaseQueryString(case_name, clusters, additional_filters, graph_filter);
    }

    getComputationFilterString(computation: ComputationModel) {
        return this.elasticsearchBaseQueryManagerDao.getComputationFilterString(computation);
    }

    applyFilter(filter: string, params: FilterParamModel[]) {
        return this.elasticsearchBaseQueryManagerDao.applyFilter(filter, params);
    }

    getFilterAdditionaCombination(filters: string[]) {
        return this.elasticsearchBaseQueryManagerDao.getAdditionaFilterCombination(filters);
    }

    getGraphFilterFromMactimeType(mactime_type: string) {
        return this.elasticsearchBaseQueryManagerDao.getGraphFilterFromMactimeType(mactime_type);
    }

    getMatchStringFromTags(clusters: string[]) {
        return this.elasticsearchBaseQueryManagerDao.getMatchStringFromTags(clusters);
    }

    getMatchStringFromCase(case_name: string) {
        return this.elasticsearchBaseQueryManagerDao.getMatchStringFromCase(case_name);
    }

    getBaseClusters(clusters) {
        return this.elasticsearchBaseQueryManagerDao.getBaseClusters(clusters);
    }

    getFilterCombination(filters: string[]) {
        return this.elasticsearchBaseQueryManagerDao.getFilterCombination(filters);
    }

    buildShouldMatchFilter(params: string[], values: string[]) {
        return this.elasticsearchBaseQueryManagerDao.buildShouldMatchFilter(params, values);
    }

    buildMustMatchFilter(params: string[], values: string[]) {
        return this.elasticsearchBaseQueryManagerDao.buildMustMatchFilter(params, values);
    }

    buildAdditionSearchFilter(searchString: string) {
        return this.elasticsearchBaseQueryManagerDao.buildAdditionSearchFilter(searchString);
    }

    buildAdditionRangeFilter(from: string, to: string) {
        return this.elasticsearchBaseQueryManagerDao.buildAdditionRangeFilter(from, to);
    }




}


