import {Injectable} from '@angular/core';

import {Client} from 'elasticsearch-browser';
import {ComputationModel} from './models/computation.model';

@Injectable()
export class ElasticsearchService {

    private client: Client;
    private metadata_index = 'metadata';
    private metadata_type = 'mactimes';

    private filter_index = 'filter';
    private filter_type = '';


    constructor() {
        if (!this.client) {
            this.connect();
        }
    }

    private connect() {
        this.client = new Client({
            host: 'http://78.128.250.232:9200',
            httpAuth: 'elastic:timesix-elk',
            // log: 'trace'
        });
    }

    runQuery(_query): any {
        return this.client.search({
            index: this.metadata_index,
            type: this.metadata_type,
            body: _query
        });
    }

    runFilterQuery(_query): any {
        return this.client.search({
            index: this.filter_index,
            type: this.filter_type,
            body: _query
        });
    }

    updateQuery(_index, _type, _query): any {
        return this.client.updateByQuery({
            index: this.metadata_index,
            type: this.metadata_type,
            body: _query
        });
    }

    getFilterByName(_name) {
        return this.client.search({
            index: this.filter_index,
            type: this.filter_type,
            body: {
                'query': {
                    'term': {
                        'name.keyword': {
                            'value': _name
                        }
                    }
                }
            }
        });
    }

    getTags(_case): any {
        return this.client.search({
            index: this.metadata_index,
            type: this.metadata_type,
            body: {
                'query': {
                    'bool': {
                        'must': [
                            {
                                'match': {
                                    'case.keyword': _case
                                }
                            }
                        ]
                    }
                },
                'aggs': {
                    'tags': {
                        'terms': {
                            'field': 'tags.keyword',
                            'size': 2147483647
                        }
                    }
                }
            }
        });
    }

    addTag(_case, _filter: string, _tag: string): any {
        let bodyString = '{';
        bodyString = bodyString + this.queryBuilder(_filter, _case, null, null, null);
        bodyString = bodyString + ',' +
            '"script": {' +
            '"source": "ctx._source.tags.add(params.tag)",' +
            '"lang": "painless",' +
            '"params": {' +
            '"tag": "' + _tag + '"' +
            '}' +
            '}' +
            '}';
        return this.client.updateByQuery({
            index: this.metadata_index,
            type: this.metadata_type,
            body: bodyString
        });
    }

    removeTag(_case, _filter: string, _clusters: string[], _tag: string): any {
        let bodyString = '{';
        bodyString = bodyString + this.queryBuilder(_filter, _case, _clusters, null, null);
        bodyString = bodyString + ',' +
            '"script": {' +
            '"source": "ctx._source.tags.removeAll(Collections.singleton(params.tag))",' +
            '"lang": "painless",' +
            '"params": {' +
            '"tag": "' + _tag + '"' +
            '}' +
            '}' +
            '}';
        return this.client.updateByQuery({
            index: this.metadata_index,
            type: this.metadata_type,
            body: bodyString
        });
    }

    queryBuilder(_filter: string, _case: string, _clusters: string[], _graph_filter: string, _addition_filters: string[]) {
        let bodyString = '"query": {' +
            '"bool": {' +
            '"must": [';
        if (_addition_filters != null && _addition_filters !== undefined) {
            for (let index = 0; index < _addition_filters.length; index++) {
                bodyString = bodyString + '{';
                bodyString = bodyString + _addition_filters[index];
                bodyString = bodyString + '},';
            }
        }
        bodyString = bodyString + '{"bool": {' +
            '"should": [';
        if (_clusters != null && _clusters !== undefined) {
            for (let index = 0; index < _clusters.length; index++) {
                bodyString = bodyString + '{"bool": {' +
                    '"must": [' +
                    '{"match": {' +
                    '"case.keyword": "' + _case + '"' +
                    '}},' +
                    '{"match": {' +
                    '"tags.keyword": "' + _clusters[index] + '"' +
                    '}}';
                if (_graph_filter != null && _graph_filter !== undefined) {
                    bodyString = bodyString + _graph_filter;
                }
                bodyString = bodyString + '] } }';
                if (index < (_clusters.length - 1)) {
                    bodyString = bodyString + ',';
                }
            }
        }
        if (_filter != null && _filter !== undefined) {
            if (_clusters != null && _clusters !== undefined) {
                if (_clusters.length > 0) {
                    bodyString = bodyString + ',';
                }
            }
            bodyString = bodyString + '{"bool": {' +
                '"must": [' +
                '{"match": {' +
                '"case.keyword": "' + _case + '"' +
                '}}';
            bodyString = bodyString + _filter;
            if (_graph_filter != null && _graph_filter !== undefined) {
                bodyString = bodyString + _graph_filter;
            }
            bodyString = bodyString + '] } }';
        } else {
            if (_clusters.length > 0) {
                bodyString = bodyString + ',';
            }
            bodyString = bodyString + '{"bool": {' +
                '"must_not": [' +
                '{"match_all": {}}';
            if (_graph_filter != null && _graph_filter !== undefined) {
                bodyString = bodyString + _graph_filter;
            }
            bodyString = bodyString + '] }}';
        }
        bodyString = bodyString + '] } }] } }';
        return bodyString;

    }
}
