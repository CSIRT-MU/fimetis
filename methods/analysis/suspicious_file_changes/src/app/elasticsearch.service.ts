import { Injectable } from '@angular/core';

import { Client } from 'elasticsearch-browser';

@Injectable()
export class ElasticsearchService {

  private client: Client;

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

  createIndex(name): any {
    return this.client.indices.create(name);
  }

  isAvailable(): any {
    return this.client.ping({
      requestTimeout: Infinity,
      body: 'Elasticsearch is running!'
    });
  }

  getAllDocumentsWithScroll(_index, _type, _size): any {
    return this.client.search({
      index: _index,
      type: _type,
      // Set to 1 minute because we are calling right back
      scroll: '1m',
      filterPath: ['hits.hits._source', 'hits.total', '_scroll_id'],
      body: {
        'size': _size,
        'query': {
          'match_all': {}
        },
        'sort': [
          {
            '@timestamp': {
              'order': 'asc'
            }
          }
        ]
      }
    });
  }

  getNextPage(scroll_id): any {
    return this.client.scroll({
      scrollId: scroll_id,
      scroll: '10s',
      filterPath: ['hits.hits._source', 'hits.total', '_scroll_id']
    });
  }

  getPageWithScroll(_index, _type, _case, _size, _page_index): any {
    return this.client.search({
      index: _index,
      type: _type,
      scroll: '10s',
      filterPath: ['hits.hits._source', 'hits.total', '_scroll_id'],
      body: {
        'from': (_size * _page_index),
        'size': _size,
        'query': {
          'term': {
            'case.keyword': {
              'value': _case
            }
          }
        },
        'sort': [
          {
            '@timestamp': {
              'order': 'asc'
            }
          }
        ]
      }
    });
  }

  getAggregatedPageWithScroll(_index, _type, _case, _size, _page_index): any {
    return this.client.search({
      index: _index,
      type: _type,
      scroll: '10s',
      filterPath: ['hits.hits._source', 'hits.total', '_scroll_id'],
      body: {
        'from': (_size * _page_index),
        'size': _size,
        'query': {
          'bool': {
            'must': [
              {
                'match': {
                  'case.keyword': _case
                }
              },
              {
                'match': {
                  'Grouped': 'False'
                }
              }
            ]
          }
        },
        'sort': [
          {
            '@timestamp': {
              'order': 'asc'
            }
          }
        ]
      }
    });
  }

  getPage(_index, _type, _case, _size, _page_index): any {
    return this.client.search({
      index: _index,
      type: _type,
      filterPath: ['hits.hits._source', 'hits.total', '_scroll_id'],
      body: {
        'from': (_size * _page_index),
        'size': _size,
        'query': {
          'term': {
            'case.keyword': {
              'value': _case
            }
          }
        },
        'sort': [
          {
            '@timestamp': {
              'order': 'asc'
            }
          }
        ]
      }
    });
  }

  getPageFiltered(_index, _type, _case, _size, _page_index, from, to): any {
    return this.client.search({
      index: _index,
      type: _type,
      filterPath: ['hits.hits._source', 'hits.total', '_scroll_id'],
      body: {
        'from': (_size * _page_index),
        'size': _size,
        'query': {
          'term': {
            'case.keyword': {
              'value': _case
            }
          },
          'range': {
            '@timestamp': {
              'gte': from,
              'lte': to
            }
          }

        },
        'sort': [
          {
            '@timestamp': {
              'order': 'asc'
            }
          }
        ]
      }
    });
  }

  getAggregatedPage(_index, _type, _case, _size, _page_index): any {
    return this.client.search({
      index: _index,
      type: _type,
      filterPath: ['hits.hits._source', 'hits.total', '_scroll_id'],
      body: {
        'from': (_size * _page_index),
        'size': _size,
        'query': {
          'bool': {
            'must': [
              {
                'match': {
                  'case.keyword': _case
                }
              },
              {
                'match': {
                  'Grouped': 'False'
                }
              }
            ]
          }
        },
        'sort': [
          {
            '@timestamp': {
              'order': 'asc'
            }
          }
        ]
      }
    });
  }

  getSubEntries(_index, _type, _case, _size, _id): any {
    return this.client.search({
      index: _index,
      type: _type,
      body: {
        'from': 0,
        'size': _size,
        'query': {
          'bool': {
            'must': [
              {
                'match': {
                  'case.keyword': _case
                }
              },
              {
                'match': {
                  'Grouped': 'True'
                }
              },
              {
                'match': {
                  'Group Id': _id
                }
              }
            ]
          }
        },
        'sort': [
          {
            '@timestamp': {
              'order': 'asc'
            }
          }
        ]
      }
    });
  }


  getCases(_index, _type): any {
    return this.client.search({
      index: _index,
      type: _type,
      body: {
        'aggs': {
          'cases': {
            'terms': {
              'field': 'case.keyword',
              'size': 2147483647
            }
          }
        }
      }
    });
  }

  getFilters(_index, _type): any {
    return this.client.search({
      index: _index,
      type: _type,
      body: {
        'aggs': {
          'filters': {
            'terms': {
              'field': 'name.keyword',
              'size': 2147483647
            }
          }
        }
      }
    });
  }

  getTags(_index, _type, _case): any {
    return this.client.search({
      index: _index,
      type: _type,
      body: {
        'query': {
          'bool': {
            'must': [
              {'match': {
                'case.keyword': _case
                }}
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

  getGraphData(_index, _type, _case, _stampType): any {
    return this.client.search({
      index: _index,
      type: _type,
      body: {
        'query': {
          // 'term': {
          //   'case.keyword': {
          //     'value': _case
          //   }
          // }
          'bool': {
            'must': [
              {
                'match': {
                  'case.keyword': _case
                }
              },
              {
                'match': {
                  'Type': _stampType
                }
              }
            ]
          }
        },
        'aggs': {
          'dates': {
            'date_histogram': {
              'field': '@timestamp',
              'interval': 'day'
            }
          }
        }
      }
    });
  }

  getFilteredPage(_index, _type, _case, _size, _page_index, _filter: string, _clusters: string[], _sort: string, _sort_order: string, _additional_filters: string[]): any {
    let bodyString = '{' +
      '"from": ' + (_size * _page_index) + ',' +
      '"size": ' + _size + ',';
    bodyString = bodyString + this.queryBuilder(_filter, _case, _clusters, null, _additional_filters);
    bodyString = bodyString +
      ',' +
      '"sort": [' +
      '{';
      switch (_sort) {
        case 'timestamp': {
          bodyString = bodyString + '"@timestamp"';
          break;
        }
        case 'name': {
          bodyString = bodyString + '"File Name.keyword"';
          break;
        }
        case 'size': {
          bodyString = bodyString + '"Size.keyword"';
          break;
        }
        case 'type': {
          bodyString = bodyString + '"Type.keyword"';
          break;
        }
        default: {
          bodyString = bodyString + '"@timestamp"';
          break;
        }
      }
      bodyString = bodyString +
      ': {' +
      '"order": "' + _sort_order + '"' +
      '}' +
      '}' +
      ']' +
      '}';
    return this.client.search({
      index: _index,
      type: _type,
      body: bodyString
    });
  }

  getFilterByName(_index, _type, _name) {
    return this.client.search({
      index: _index,
      type: _type,
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


  getFilteredGraphData(_index, _type, _case, _stampType, _filter: string, _clusters: string[], _frequency): any {
    let bodyString = '{';
    const graphFilter = ', ' +
      '{"match": { ' +
      '"Type": "' + _stampType + '"' +
      '}}';
    bodyString = bodyString + this.queryBuilder(_filter, _case, _clusters, graphFilter, null);
    bodyString = bodyString + ',' +
      '"aggs": {' +
      '"dates": {' +
        '"date_histogram": {' +
          '"field": "@timestamp",' +
            '"interval": "' + _frequency + '"' +
        '}' +
      '}' +
    '}' +
    '}';
    return this.client.search({
      index: _index,
      type: _type,
      body: bodyString
    });
  }

  addTag(_index, _type, _case, _filter: string, _tag: string): any {
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
      index: _index,
      type: _type,
      body: bodyString
    });
  }

  removeTag(_index, _type, _case, _filter: string, _clusters: string[], _tag: string): any {
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
      index: _index,
      type: _type,
      body: bodyString
    });
  }

  getFilteredPageScroll(_index, _type, _case, _size, _offset, _filter: string, _clusters: string[], _sort: string, _sort_order: string, _additional_filters: string[]): any {
    let bodyString = '{' +
      '"from": ' + _offset + ',' +
      '"size": ' + _size + ',';
    bodyString = bodyString + this.queryBuilder(_filter, _case, _clusters, null, _additional_filters);
    bodyString = bodyString +
      ',' +
      '"sort": [' +
      '{';
    switch (_sort) {
      case 'timestamp': {
        bodyString = bodyString + '"@timestamp"';
        break;
      }
      case 'name': {
        bodyString = bodyString + '"File Name.keyword"';
        break;
      }
      case 'size': {
        bodyString = bodyString + '"Size.keyword"';
        break;
      }
      case 'type': {
        bodyString = bodyString + '"Type.keyword"';
        break;
      }
      default: {
        bodyString = bodyString + '"@timestamp"';
        break;
      }
    }
    bodyString = bodyString +
      ': {' +
      '"order": "' + _sort_order + '"' +
      '}' +
      '}' +
      ']' +
      '}';
    return this.client.search({
      index: _index,
      type: _type,
      body: bodyString
    });
  }

  queryBuilder(_filter: string, _case: string, _clusters: string[], _graph_filter: string, _addition_filters: string[]) {
    let bodyString = '"query": {' +
                        '"bool": {' +
                            '"must": [';
    if (_addition_filters != null && _addition_filters !== undefined) {
      for (let index = 0; index < _addition_filters.length; index++ ) {
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
      bodyString = bodyString +  '{"bool": {' +
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
