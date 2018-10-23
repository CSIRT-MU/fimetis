import {ComputationModel} from '../models/computation.model';
import {ClusterModel} from '../models/cluster.model';
import {ElasticsearchService} from '../elasticsearch.service';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';

export class ComputationManager {
    private _computations: ComputationModel[];
    private _case: string;

    constructor(private es: ElasticsearchService) {}

    get computations(): ComputationModel[] {
        return this._computations;
    }

    set computations(value: ComputationModel[]) {
        this._computations = value;
    }

    get case(): string {
        return this._case;
    }

    set case(value: string) {
        this._case = value;
    }

    getClusters(index, type): ClusterModel[] {
        let _clusters: ClusterModel[] = [];

        for (const computation of this.computations) {
            if (computation.isSelected) {
                const result = this.getClustersForComputation(index, type, computation);
                _clusters = _clusters.concat(result);
            }
        }
        console.log('Im returning all clusters: ', _clusters);
        return _clusters;
    }

    private getClustersForComputation(index, type, computation: ComputationModel): ClusterModel[] {
        const _clusters: ClusterModel[] = [];
        // TODO return more than one cluster
        const cluster = new ClusterModel();
        this.es.runQuery(index, type, this.buildComputationQuery(computation)).then(
            response => {
                cluster.count = response.hits.total;
            }
        );
        // this.getDatabaseData(index, type, computation).then(res => {
        //     cluster.count = res;
        // });
        cluster.name = 'cluster-' + computation.name;
        cluster.color = computation.color;
        cluster.tagged = false;
        cluster.computation = computation;
        _clusters.push(cluster);
        console.log('Im returning clusters: ', _clusters);
        return _clusters;
    }

    private async getDatabaseData(index, type, computation): Promise<any> {
        const promise = new Promise((resolve, reject) => {
            this.es.runQuery(index, type, this.buildComputationQuery(computation)).then(
                response => {
                    resolve(response.hits.total);
                }
            );
        });
        return promise;
    }

    private buildComputationQuery(computation: ComputationModel) {
        let bodyString = '{"query": {' +
            '"bool": {' +
            ' "must": [' +
            ' {"match": {"case.keyword": "' + this._case + '"}}';
        bodyString += ', ' + this.getComputationFilterString(computation);
        bodyString += ']}}}';
        return bodyString;
    }

    getComputationFilterString(computation: ComputationModel) {
        const appliedFilters = [];
        let filter: FilterModel;
        for (filter of Array.from(computation.filters)) {
            if (filter.isSelected) {
                appliedFilters.push(this.applyFilter(filter.json, filter.params));
            }
        }
        return this.getFilterCombination(appliedFilters);
    }

    applyFilter(filter: string, params: FilterParamModel[]) {
        let result = filter;
        for (const param of params) {
            result = result.replace('${{' + param.name + '}}$', param.value);
        }
        return result;
    }

    getFilterCombination(filters: string[]) {
        let result = filters[0];
        for (let i = 1; i < filters.length; i++) {
            result = result + ', ' + filters[i];
        }
        return result;
    }
}
