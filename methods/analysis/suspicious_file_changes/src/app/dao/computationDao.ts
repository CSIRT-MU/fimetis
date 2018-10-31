import {ElasticsearchService} from '../elasticsearch.service';
import {ComputationModel} from '../models/computation.model';
import {ClusterModel} from '../models/cluster.model';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';

export class ComputationDao {

    constructor(private es: ElasticsearchService) {
    }

    getClustersForComputation(index, type, case_name, computation: ComputationModel): ClusterModel[] {
        const _clusters: ClusterModel[] = [];
        // TODO return more than one cluster
        const cluster = new ClusterModel();
        console.log(this.buildComputationQuery(case_name, computation));
        this.es.runQuery(index, type, this.buildComputationQuery(case_name, computation)).then(
            response => {
                cluster.count = response.hits.total;
                console.log(response);
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

    async getDatabaseData(index, type, case_name, computation): Promise<any> {
        const promise = new Promise((resolve, reject) => {
            this.es.runQuery(index, type, this.buildComputationQuery(computation, case_name)).then(
                response => {
                    resolve(response.hits.total);
                }
            );
        });
        return promise;
    }


    private buildComputationQuery(case_name, computation: ComputationModel) {
        let bodyString = '{"query": {' +
            '"bool": {' +
            ' "must": [' +
            ' {"match": {"case.keyword": "' + case_name + '"}}';
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
