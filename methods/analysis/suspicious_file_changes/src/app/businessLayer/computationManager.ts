import {ComputationModel} from '../models/computation.model';
import {ClusterModel} from '../models/cluster.model';
import {ElasticsearchService} from '../elasticsearch.service';

export class ComputationManager {
    private _computations: ComputationModel[];

    constructor(private es: ElasticsearchService) {}

    get computations(): ComputationModel[] {
        return this._computations;
    }

    set computations(value: ComputationModel[]) {
        this._computations = value;
    }

    getClusters(): ClusterModel[] {
        const _clusters: ClusterModel[] = [];

        for (const computation of this.computations) {
            if (computation.isSelected) {
                _clusters.concat(this.getClustersForComputation(computation));
            }
        }

        return _clusters;
    }

    private getClustersForComputation(computation: ComputationModel): ClusterModel[] {
        const _clusters: ClusterModel[] = [];
        // this.es.runQuery(this.buildComputationQuery(computation));
        return _clusters;
    }

    private buildComputationQuery(computation: ComputationModel) {
        return '';
    }
}
