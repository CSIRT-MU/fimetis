import {ClusterModel} from './cluster.model';

export class ClusteringOverviewModel {
    name: string;
    color: string;
    preLoaded = false;
    clusters: ClusterModel[] = [];
    isSelected = true;
}
