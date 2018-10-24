import {Injectable} from '@angular/core';
import {ElasticsearchService} from '../elasticsearch.service';
import 'rxjs/add/operator/toPromise';


@Injectable()

export class BaseManager {

    constructor(private es: ElasticsearchService) {}

    async getCases(index, type): Promise<any> {
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
            this.es.runQuery(index, type, query)
                .then(response => {
                    const cases = response.aggregations.cases.buckets;
                    resolve(cases);
                }
            );

        } );

        return promise;

    }

    async getFilters(index, type): Promise<any> {
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
            this.es.runQuery(index, type, query)
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
