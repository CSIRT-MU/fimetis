import {FilterParamModel} from './filterParam.model';

export class FilterModel {
  name: string;
  type: string;
  json: string;
  params: FilterParamModel[] = [];
  completed: string;
  isSelected = true;
}
