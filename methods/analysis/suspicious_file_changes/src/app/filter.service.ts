import { Injectable } from '@angular/core';
import {ElasticsearchService} from './elasticsearch.service';
import {forEach} from '@angular/router/src/utils/collection';
import {FilterParamModel} from './models/filterParam.model';

@Injectable({
  providedIn: 'root'
})

export class FilterService {

  constructor(private es: ElasticsearchService) { }

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
    // for (const filter of filters) {
    //   result = result + ', ' + filter;
    // }
    return result;
  }

  buildShouldMatchFilter(params: string[], values: string[]) {
    if (params.length !== values.length) {
      return '';
    }
    let filter = '{"bool": {' +
      '"should": [';
    for (let index = 0; index < params.length; index++) {
      filter += '{"match": {' +
        '"' + params[index] + '": "' + values[index] + '" }}';
      if (index < (params.length - 1)) {
        filter += ',';
      }
    }
    filter += ']}}';
    return filter;
  }

  buildMustMatchFilter(params: string[], values: string[]) {
    if (params.length !== values.length) {
      return '';
    }
    let filter = '{"bool": {' +
      '"must": [';
    for (let index = 0; index < params.length; index++) {
      filter += '{"match": {' +
        '"' + params[index] + '": "' + values[index] + '" }}';
      if (index < (params.length - 1)) {
        filter += ',';
      }
    }
    filter += ']}}';
    return filter;
  }

  buildAdditionSearchFilter(searchString: string) {
    return '"multi_match": {' +
        '"query": "' + searchString + '",' +
        '"fields": ["File Name", "Size"]' +
      '}';
  }

  buildAdditionRangeFilter(from: string, to: string) {
    let filter = '"range": {' +
        '"@timestamp": {';
    if (from != null && from !== undefined) {
      filter += '"gte": "' + from + '"';
      if (to != null && to !== undefined) {
        filter += ',';
      }
    }
    if (to != null && to !== undefined) {
      filter += '"lte": "' + to + '"';
    }
    filter += '}' +
      '}' +
    '}';
    return filter;
}
}
