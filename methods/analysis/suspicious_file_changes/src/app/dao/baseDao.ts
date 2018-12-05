import {ElasticsearchService} from '../elasticsearch.service';
import {Injectable} from '@angular/core';
import {ElasticsearchBaseQueryDao} from './elasticsearchBaseQueryDao';

export class BaseDao {

    private elasticsearchBaseQueryDao;

    constructor(private es: ElasticsearchService) {
        this.elasticsearchBaseQueryDao = new ElasticsearchBaseQueryDao();
    }

    // asc for first entry, desc for last entry
    getFirstOrLast(case_name, clusters, additional_filters, ascOrDesc): Promise<any>  {
        const promise = new Promise((resolve, reject) => {
            let entry;
            this.es.runQuery(this.buildFirstOrLastQuery(case_name, clusters, additional_filters, ascOrDesc, null))
                .then(
                    response => {
                        if (response.hits.total !== 0) {
                            entry = response.hits.hits[0]._source['@timestamp'];
                        } else {
                            entry = 0;
                        }
                        resolve(entry);
                    }
                );
        });
        return promise;

    }


    buildFirstOrLastQuery(case_name, clusters, additional_filters, first_or_last, mactime_type) {
        let first_or_lastquery = '{'; // start of all query string
        first_or_lastquery += '"from": 0';
        first_or_lastquery += ',';
        first_or_lastquery += '"size": 1';
        first_or_lastquery += ',';

        first_or_lastquery += this.elasticsearchBaseQueryDao.getBaseQueryString(
            case_name,
            clusters,
            additional_filters,
            this.elasticsearchBaseQueryDao.getGraphFilterFromMactimeType(mactime_type));

        first_or_lastquery += ','; // separator between query and sort
        first_or_lastquery += '"sort": ['; // begin of sort field
        first_or_lastquery += '{'; // begin of sort parametr

        first_or_lastquery += '"@timestamp": ';

        first_or_lastquery += '{'; // begin of sort order
        first_or_lastquery += '"order": "' + first_or_last + '"'; // Adding sorting order
        first_or_lastquery += '}'; // end of sorting order
        first_or_lastquery += '}'; // end of sort parametr
        first_or_lastquery += ']'; // end of sort field
        first_or_lastquery += '}'; // end of all string

        return first_or_lastquery;
    }


    async getCases(): Promise<any> {
        const query = {
            'aggs': {
                'cases': {
                    'terms': {
                        'field': 'case.keyword',
                        'size': 2147483647
                    }
                }
            }
        };

        const promise = new Promise((resolve, reject) => {
            this.es.runQuery(query)
                .then(response => {
                        const cases = response.aggregations.cases.buckets;
                        resolve(cases);
                    }
                );

        } );

        return promise;

    }


    async getFilters(): Promise<any> {
        const query = {
            'aggs': {
                'filters': {
                    'terms': {
                        'field': 'name.keyword',
                        'size': 2147483647
                    }
                }
            }
        };

        const promise = new Promise((resolve, reject) => {
            this.es.runFilterQuery(query)
                .then(response => {
                        const filters = response.aggregations.filters.buckets;
                        console.log(filters);

                        resolve(filters);
                    }
                );

        } );

        return promise;
    }

}
