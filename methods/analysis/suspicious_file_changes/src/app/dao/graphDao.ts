import {ElasticsearchService} from '../elasticsearch.service';
import {ElasticsearchBaseQueryDao} from './elasticsearchBaseQueryDao';

export class GraphDao {

    private elasticsearchBaseQueryDao;

    constructor(private es: ElasticsearchService) {
        this.elasticsearchBaseQueryDao = new ElasticsearchBaseQueryDao();
    }


    async getData(index, type, case_name, clusters, additional_filters,  mactime_type, frequency): Promise<any> {
        const queryString = this.buildQuery(case_name, clusters, additional_filters, mactime_type, frequency);
        const promise = new Promise((resolve, reject) => {
            this.es.runQuery(index, type, queryString)
                .then(response => {
                        const data = response.aggregations.dates.buckets;
                        const x = data.map(d => d['key_as_string']);
                        const y = data.map(d => d['doc_count']);
                        resolve({x: x, y: y});
                    }, error => {
                        console.error(error);
                        console.log('loading mactimes async failed');
                        reject();
                    }
                );
        } );
        return promise;
    }

    // asc for first entry, desc for last entry
    getFirstOrLast(index, type, case_name, clusters, additional_filters, ascOrDesc): Promise<any>  {
        const promise = new Promise((resolve, reject) => {
            let entry;
            this.es.runQuery(index, type, this.buildFirstOrLastQuery(case_name, clusters, additional_filters, ascOrDesc, null))
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


    buildQuery(case_name, clusters, additional_filters, mactime_type, frequency) {
        let builded_query = '{'; // start of all query string

        // get the base query string
        builded_query += this.elasticsearchBaseQueryDao.getBaseQueryString(
            case_name,
            clusters,
            additional_filters,
            this.elasticsearchBaseQueryDao.getGraphFilterFromMactimeType(mactime_type));

        builded_query += ','; // separator between query and aggs
        builded_query += '"aggs": {'; // start of aggregation
        builded_query += '"dates": {'; // start of dates
        builded_query += '"date_histogram": {'; // start of date histogram
        builded_query += '"field": "@timestamp"';
        builded_query += ','; // separator between field and interval
        builded_query += '"interval": "' + frequency + '"';

        builded_query += '}'; // end of histogram
        builded_query += '}'; // end of dates
        builded_query += '}'; // end of aggregations

        builded_query += '}'; // end of all string

        return builded_query;
    }

}
