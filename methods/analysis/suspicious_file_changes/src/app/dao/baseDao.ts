import {ElasticsearchService} from '../elasticsearch.service';
import {Injectable} from '@angular/core';

export class BaseDao {

    constructor(private es: ElasticsearchService) {

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
