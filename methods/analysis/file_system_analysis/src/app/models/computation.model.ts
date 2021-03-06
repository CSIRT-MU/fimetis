import {FilterModel} from './filter.model';

export class ComputationModel {
    name: string;
    color: string;
    filters: Set<FilterModel> = new Set<FilterModel>();
    isSelected = true;
    description = '';
}
