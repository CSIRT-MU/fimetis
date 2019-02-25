import {ElasticsearchService} from '../elasticsearch.service';
import {ElasticsearchBaseQueryDao} from './elasticsearchBaseQueryDao';

export class GraphDao {

    private elasticsearchBaseQueryDao;

    constructor(private es: ElasticsearchService) {
        this.elasticsearchBaseQueryDao = new ElasticsearchBaseQueryDao();
    }


    async getData(case_name, clusters, additional_filters, mactime_type, frequency): Promise<any> {
        const queryString = this.buildQuery(case_name, clusters, additional_filters, mactime_type, frequency);
        const promise = new Promise((resolve, reject) => {
            this.es.runQuery(queryString)
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
        });
        return promise;
    }

    buildQuery(case_name, clusters, additional_filters, mactime_type, frequency) {
        console.log(additional_filters);
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
