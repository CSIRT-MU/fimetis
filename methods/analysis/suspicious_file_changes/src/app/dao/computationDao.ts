import {ElasticsearchService} from '../elasticsearch.service';
import {ComputationModel} from '../models/computation.model';
import {ClusterModel} from '../models/cluster.model';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';
import {ElasticsearchBaseQueryDao} from './elasticsearchBaseQueryDao';

export class ComputationDao {

    private elasticsearchBaseQueryDao;
    constructor(private es: ElasticsearchService) {
        this.elasticsearchBaseQueryDao = new ElasticsearchBaseQueryDao();
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
        cluster.name = computation.name;
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

        const computationFilterString = this.getComputationFilterString(computation);
        if (computationFilterString != null) {
            bodyString += ', ' + this.getComputationFilterString(computation);
        } else {
            bodyString += ',{"bool": {' +
                ' "must_not": [' + '{ "match_all": {}}]}}';
        }
        bodyString += ']}}}';
        return bodyString;
    }


    getComputationFilterString(computation: ComputationModel) {
        return this.elasticsearchBaseQueryDao.getComputationFilterString(computation);
    }

}
