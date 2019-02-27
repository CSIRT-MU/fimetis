import {ElasticsearchService} from '../elasticsearch.service';
import {Injectable} from '@angular/core';
import {ElasticsearchBaseQueryDao} from './elasticsearchBaseQueryDao';

export class BaseDao {

    private elasticsearchBaseQueryDao;

    constructor(private es: ElasticsearchService) {
        this.elasticsearchBaseQueryDao = new ElasticsearchBaseQueryDao();
    }

    /**
     * Returns first or last entry from given clusters
     * Used for counting the frequency for displaying graph
     *
     * @param case_name Name of the case
     * @param clusters Clusters from those get the first or last entry
     * @param additional_filters Optional filters
     * @param ascOrDesc If asc then first entry, if desc then last
     * @return Promise<any>
     */
    getFirstOrLast(case_name, clusters, additional_filters, ascOrDesc): Promise<any> {
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
                    }, error => {
                        reject(error);
                    }
                );
        });
        return promise;

    }


    /**
     * Build the query for counting first or last entry from given clusters
     *
     * @param case_name Name of the case
     * @param clusters Clusters from those get the first or last entry
     * @param additional_filters Optional filters
     * @param first_or_last Asc for first and the desc for the last
     * @param mactime_type The type of timestamp m | a | c | b
     * @return string Elasticsearch query
     */
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


    /**
     * Loads cases from the database
     *
     * @return Promise<any> Array of cases
     */
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
                    }, error => {
                        reject(error);
                    }
                );

        });

        return promise;

    }

    /**
     * Loads filters from database
     * @return Promise<any> Array of filters
     */
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
                    }, error => {
                        reject(error);
                    }
                );

        });

        return promise;
    }

    /**
     * Loads the filter by given name
     * @param filter_name Name of the filter in database
     * @return Promise<any> Founded filter
     */
    async getFilterByName(filter_name): Promise<any> {
        const query = {
            'query': {
                'term': {
                    'name.keyword': {
                        'value': filter_name
                    }
                }
            }
        };

        const promise = new Promise((resolve, reject) => {
            this.es.runFilterQuery(query)
                .then(response => {
                    const filter = response.hits.hits[0]._source;
                    console.log(filter);
                    resolve(filter);
                }, error => {
                    reject(error);
                });
        });

        return promise;
    }
}
