import {FilterModel} from './filter.model';

export class ComputationModel {
    name: string;
    color: string;
    filters: FilterModel[] = [];
    isSelected = true;
    description = '';
}
