import {ComputationModel} from './computation.model';

export class ClusterModel {
    name: string;
    color: string;
    count: number;
    computation: ComputationModel;
    tagged: boolean;
    tag: string;
    selectMode: ClusterSelectMode = ClusterSelectMode.notSelected;
    subClusters: ClusterModel[] = [];
}

export enum ClusterSelectMode {
    notSelected = 0,
    added = 1,
    deducted = 2
}

export namespace ClusterSelectMode {
    export function next(mode: ClusterSelectMode): ClusterSelectMode {
        return ((mode + 1) % 3) as ClusterSelectMode;
    }
}
