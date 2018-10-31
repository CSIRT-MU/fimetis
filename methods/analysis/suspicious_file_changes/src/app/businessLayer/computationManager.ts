import {ComputationModel} from '../models/computation.model';
import {ClusterModel} from '../models/cluster.model';
import {ElasticsearchService} from '../elasticsearch.service';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';
import {ComputationDao} from '../dao/computationDao';

export class ComputationManager {
    private _computations: ComputationModel[];
    private _case: string;

    private computationDao;

    constructor(private es: ElasticsearchService) {
        this.computationDao = new ComputationDao(es);
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








}
