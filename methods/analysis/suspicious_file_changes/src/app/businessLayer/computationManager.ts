import {ComputationModel} from '../models/computation.model';
import {ClusterModel} from '../models/cluster.model';
import {ElasticsearchService} from '../elasticsearch.service';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';
import {ComputationDao} from '../dao/computationDao';
import {ClusteringOverviewModel} from '../models/clusteringOverview.model';
import {ClusterDao} from '../dao/clusterDao';

export class ComputationManager {
    private _computations: ComputationModel[];
    private _case: string;

    private computationDao;
    private clusterDao;

    constructor(private es: ElasticsearchService) {
        this.computationDao = new ComputationDao(es);
        this.clusterDao = new ClusterDao(es);
    }

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

    getClustersForComputation(index, type, computation: ComputationModel): ClusterModel[] {
        return this.computationDao.getClustersForComputation(index, type, this.case, computation);
    }

    async getDatabaseData(index, type, computation): Promise<any> {
        return this.computationDao.getDatabaseData(index, type, this.case, computation);
    }


    getClusters(index, type): ClusterModel[] {
        let _clusters: ClusterModel[] = [];

        for (const computation of this.computations) {
            if (computation.isSelected) {
                const result = this.computationDao.getClustersForComputation(index, type, this.case, computation);
                _clusters = _clusters.concat(result);
            }
        }
        console.log('Im returning all clusters: ', _clusters);
        return _clusters;
    }

    getClusterings(index, type): ClusteringOverviewModel[] {
        let _clusters: ClusterModel[] = [];
        const clusterings: ClusteringOverviewModel[] = [];

        for (const computation of this.computations) {
            if (computation.isSelected) {
                const result = this.computationDao.getClustersForComputation(index, type, this.case, computation);
                _clusters = _clusters.concat(result);
            }
            const clustering = new ClusteringOverviewModel();
            clustering.name = computation.name;
            clustering.color = computation.color;
            clustering.clusters = _clusters;
            clusterings.push(clustering);
            _clusters = [];
        }
        console.log('Im returning clusterings: ', clusterings);
        return clusterings;
    }

    getPreloadedClusterings(index, type): ClusteringOverviewModel[] {
        const clusterings: ClusteringOverviewModel[] = [];

        return clusterings;
    }








}
