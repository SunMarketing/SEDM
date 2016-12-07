// ==UserScript==
// @name          Search Engine Data Miner (SEDM)
// @namespace     sedm
// @require       http://code.jquery.com/jquery.min.js
// @include       http://www.sunitka.cz*
// @include       http://www.sunitka.sk*
// @author        Sun Marketing, s.r.o.  
// @include       http://localhost:3000*
// @downloadURL   http://www.sunitka.cz/nastroje/sedm/sedm.user.js
// @updateURL     http://www.sunitka.cz/nastroje/sedm/sedm.user.js
// @icon          http://www.sunitka.cz/sedm/images/sedm.png
// @description   SEDM je nástroj sloužící k analýze výsledků vyhledávaní fulltextových vyhledávačů Google a Seznam.cz. Za pomocí nástroje lze snadno získat data o hledanosti až padesáti klíčových slov ve vyhledávači Seznam.cz, počet nalezených výsledků na Seznam.cz i Google. Autory skriptu jsou Víťa Krchov, Matěj Velička a společnost Sun Marketing.
// @version       0.37
// @date          2016-12-07
// @grant         GM_xmlhttpRequest
// ==/UserScript==

$(document).ready(function () {
    $('.greasemonkey_enabled').text('1');
    $('.install .row60 .check').removeClass('uncheck');
    $('.install .user_script .check').removeClass('uncheck');

    checkSklikSession();

    window.language = 'cs';
    if (GetURLParameter('language') != undefined) {
        window.language = GetURLParameter('language');
    }

    GM_xmlhttpRequest({
        method: 'GET',
        url: googleHost() + '/ncr',
        onload: function (response) {
        }
    });

    window.competition_analysis = true;
    window.started = false;

    $('.send_button').click(function () {
        if (window.started == false) {
            window.started = true;
            window.keyword_logs = {
                'seznam': [],
                'google': [],
                'sklik': []
            };
            window.seznam_not_processed_keywords = new Array();
            window.google_not_processed_keywords = new Array();
            window.sklik_not_processed_keywords = new Array();
            window.competitive_sites = new Array();
            window.google_serp_count = 0;
            window.seznam_serp_count = 0;
            getResults();
        }
        return false;
    });

    $('.export').click(function () {
        $('.export_data').val(JSON.stringify(dataForExport()));
        $('.export_form').submit();
        return false;
    });

    $('.analysis_export').click(function () {
        $('.analysis_export_data').val(JSON.stringify(dataForAnalysisExport()));
        $('.analysis_export_form').submit();
        return false;
    });

    if (parseFloat($('.current_version').text()) > 0.36) {
        $('.modal').removeClass('hide');
    }

    $('.analyse_checkbox').click(function () {
        if ($(this).find('.check').hasClass('uncheck')) {
            $(this).find('.check').removeClass('uncheck');
            window.competition_analysis = true;
        } else {
            $(this).find('.check').addClass('uncheck');
            window.competition_analysis = false;
        }
        return false;
    });
});

function getResults() {
    $('.export_form').addClass('hide');
    $('#message').addClass('hide');
    $('#keywords_table').removeClass('hide');
    $('#keywords_table tbody').html('');
    $('#competitive_sites').addClass('hide');
    $('#competitive_sites .sites').html('');
    $('.keyword_logs .logs').html('');
    $('.keyword_logs .logs').addClass('hide');
    $('.keyword_logs').addClass('hide');
    $('.reload').addClass('hide');
    $('.result_count').show();
    $('.search_count').show();
    $('.loading').removeClass('hide');
    var keywords = $('#keywords').val().split(',');

    var index = 0;

    interval = setInterval(function () {
        if (index < keywords.length) {
            var keyword = keywords[index];
            if (window.language == 'cs') {
                $('#keywords_table tbody').append('<tr><td class="keyword">' + keyword + '</td><td class="result_count_google"></td><td class="result_count_seznam"></td><td class="search_count_sklik"></td><td class="price_sklik"></td><td class="concurrency_sklik"></td></tr>');

                getGoogleResultCount(keyword, index);
                getSeznamResultCount(keyword, index);
                getSklikResultCount(keyword, index);
                index++;
            } else {
                $('#keywords_table tbody').append('<tr><td class="keyword">' + keyword + '</td><td class="result_count_google"></td></tr>');

                getGoogleResultCount(keyword, index);
                index++;
            }
        } else {
            window.clearInterval(interval);
            if (notProcessedKeywordsCount() > 0) {
                repeatRequests();
            } else {
                $('.loading').addClass('hide');
                window.started = false;
                if (logsCount() == 0) {
                    if (window.competition_analysis == true) {
                        showCompetitionAnalysis();
                    }
                    $('.export_form').removeClass('hide');
                    initializeKeywordsClipboard();
                    initializeAnalysisClipboard();
                } else {
                    showKeywordLogs();
                }
            }
        }
    }, 4000);
}

function repeatRequests() {
    var keywords = $('#keywords').val().split(',');
    var index = 0;
    var seznam_keywords = window.seznam_not_processed_keywords.slice(0);
    var google_keywords = window.google_not_processed_keywords.slice(0);
    var sklik_keywords = window.sklik_not_processed_keywords.slice(0);

    reload_interval = setInterval(function () {
        if (index < seznam_keywords.length || index < google_keywords.length || index < sklik_keywords.length) {
            if (index < google_keywords.length) {
                keyword = google_keywords[index];
                getGoogleResultCount(keyword, keywords.indexOf(keyword));
            }
            if (index < seznam_keywords.length) {
                keyword = seznam_keywords[index];
                getSeznamResultCount(keyword, keywords.indexOf(keyword));
            }
            if (index < sklik_keywords.length) {
                keyword = sklik_keywords[index];
                getSklikResultCount(keyword, keywords.indexOf(keyword));
            }
            index++;
        } else {
            window.clearInterval(reload_interval);
            $('.loading').addClass('hide');
            if (notProcessedKeywordsCount() == 0) {
                if (window.competition_analysis == true) {
                    showCompetitionAnalysis();
                }
                $('.export_form').removeClass('hide');
                initializeKeywordsClipboard();
                initializeAnalysisClipboard();
            } else {
                $('.reload').removeClass('hide');
                $('.reload_button').click(function () {
                    $('.keyword_logs .logs').html('');
                    $('.keyword_logs .logs').addClass('hide');
                    $('.keyword_logs').addClass('hide');
                    $('.reload').addClass('hide');
                    $('.loading').removeClass('hide');
                    repeatRequests();
                    return false;
                });
                showKeywordLogs();
            }
        }
    }, 6000);
}

function getSeznamResultCount(keyword, index) {
    var tr_element = $($('#keywords_table tbody tr')[index]);

    GM_xmlhttpRequest({
        method: 'GET',
        url: 'http://search.seznam.cz/?q=' + keyword,
        onload: function (response) {
            var div = document.createElement("div");
            div.innerHTML = response.responseText;
            if ($(div).find('#resultCount strong').length > 0) {
                var result_count = $($(div).find('#resultCount strong')[2]).text();

                window.seznam_serp_count++;
                $(div).find('.result').each(function (index) {
                    analyseUrl($(this).find('.info a').prop('href'), index + 1, 'seznam');
                });

                var keyword_index = window.seznam_not_processed_keywords.indexOf(keyword);
                if (keyword_index != -1) {
                    window.seznam_not_processed_keywords.splice(keyword_index, 1);
                    window.keyword_logs['seznam'].splice(window.keyword_logs['seznam'].indexOf(keyword), 1);
                }
            } else {
                if (window.seznam_not_processed_keywords.indexOf(keyword) == -1) {
                    window.seznam_not_processed_keywords.push(keyword);
                } else {
                    if (window.keyword_logs['seznam'].indexOf(keyword) == -1) {
                        window.keyword_logs['seznam'].push(keyword);
                    }
                }
                var result_count = '-';
            }
            tr_element.find('.result_count_seznam').text(result_count);
        }
    });
}

function getGoogleResultCount(keyword, index) {
    var google_domain = googleHost();

    var tr_element = $($('#keywords_table tbody tr')[index]);
    var url = 'http://www.google.' + google_domain + '/search?q=' + keyword + '&hl=' + window.language;

    if (window.language == 'en_US') {
        url += '&googlehost=www.google.com';
    }

    GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        onload: function (response) {
            var response_text = response.responseText;
            var patt = new RegExp("nebyl nalezen žádný odkaz");
            if (patt.test(response_text)) {
                tr_element.find('.result_count_google').text(0);
            } else {
                div = document.createElement("div");
                response_text = response_text.replace(/\/images\/nav_logo195\.png/g, 'http://www.google.cz/images/nav_logo195.png');
                div.innerHTML = response_text;
                if ($(div).find('#resultStats').length > 0) {
                    result_count_text = $(div).find('#resultStats').text();
                    match = result_count_text.match(googleRegexp());
                    tr_element.find('.result_count_google').text(match[1].replace(/,/g, ' '));

                    window.google_serp_count++;
                    $(div).find('.srg div.g').not('#imagebox_bigimages, #newsbox, #lclbox, .card-section').each(function (index) {
                        analyseUrl($(this).find('h3 a').prop('href'), index + 1, 'google');
                    });

                    var keyword_index = window.google_not_processed_keywords.indexOf(keyword);
                    if (keyword_index != -1) {
                        window.google_not_processed_keywords.splice(keyword_index, 1);
                        window.keyword_logs['google'].splice(window.keyword_logs['google'].indexOf(keyword), 1);
                    }
                } else {
                    tr_element.find('.result_count_google').text('-');
                    if (window.google_not_processed_keywords.indexOf(keyword) == -1) {
                        window.google_not_processed_keywords.push(keyword);
                    } else {
                        if (window.keyword_logs['google'].indexOf(keyword) == -1) {
                            window.keyword_logs['google'].push(keyword);
                        }
                    }
                }
            }
        }
    });
}

function loadResults(keyword, offset, index) {

    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://www.sklik.cz/api/v1/queries/captured?term=' + keyword + '&limit=20&offset=' + offset,
        onload: function (response) {
            var resultJson = JSON.parse(response.responseText);



            var searchedKeyword = resultJson.items.filter(function (obj) {
                return obj.name === keyword;
            })[0];

           
            if (searchedKeyword === undefined)
                loadResults(keyword, offset + 1, index);
            else {
                renderSklikResults(searchedKeyword, index);
                return searchedKeyword
            }
        }

    });
}

function renderSklikResults(searchedKeywordResult, index) {

    var number, price, concurrency;

  

    if (searchedKeywordResult.avgCpc != undefined || searchedKeywordResult.avgCpc != null) {
        price = searchedKeywordResult.avgCpc;
    } else {
        price = '-';
    }

    if (searchedKeywordResult.competition != undefined) {
        concurrency = searchedKeywordResult.competition;
    } else {
        concurrency = '-';
    }

    if (searchedKeywordResult['count'] != undefined) {
        number = searchedKeywordResult['count'];
    } else {
        number = '0';
    }

    $(".price_sklik").eq(index).text(price);
    $(".concurrency_sklik").eq(index).text(concurrency);
    $(".search_count_sklik").eq(index).text(number);

}

function getSklikResultCount(keyword, index) {

    loadResults(keyword, 0, index);

}

function analyseUrl(url, position, engine) {
    var parser = document.createElement('a');
    parser.href = url;
    var site = $.grep(competitive_sites, function (competitive_site) {
        return competitive_site.hostname == parser.hostname;
    });
    if (site == 0) {
        var attributes;
        if (engine == 'google') {
            attributes = {
                'hostname': parser.hostname,
                'google_points': positionPoints(position),
                'google_serp_count': 1,
                'seznam_points': 0,
                'seznam_serp_count': 0
            };
        } else {
            attributes = {
                'hostname': parser.hostname,
                'google_points': 0,
                'google_serp_count': 0,
                'seznam_points': positionPoints(position),
                'seznam_serp_count': 1
            };
        }
        competitive_sites.push(attributes);
    } else {
        if (engine == 'google') {
            site[0].google_points += positionPoints(position);
            site[0].google_serp_count += 1;
        } else {
            site[0].seznam_points += positionPoints(position);
            site[0].seznam_serp_count += 1;
        }
    }
}

function positionPoints(position) {
    if (position > 10) {
        return 0;
    } else {
        return Math.abs(position - 11);
    }
}

function checkSklikSession() {
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://www.sklik.cz/campaigns',
        onload: function (response) {
            patt = new RegExp('Sklik.cz');
            if (patt.test(response.responseText)) {
                $('.install .sklik .check').addClass('uncheck');
                $('#install').removeClass('hide');
                $('#tool').addClass('hide');
            } else {
                $('.install .sklik .check').removeClass('uncheck');
                $('#install').addClass('hide');
                $('#tool').removeClass('hide');
            }
        }
    });
}

function dataForExport() {
    var data = new Array();

    $('#keywords_table tbody tr').each(function () {
        var attrs = new Array();
        $(this).find('td').each(function (index) {
            var val;
            if (index == 0) {
                val = $(this).text();
            } else {
                val = $(this).text().replace(/,/g, '.').replace(/\s+/g, '');
            }
            attrs.push(val);
        });
        data.push(attrs);
    });

    return data;
}

function dataForAnalysisExport() {
    var sorted_sites = sortSites(competitive_sites);
    var data = new Array();

    for (var i = 0; i < sorted_sites.length; i++) {
        var site = sorted_sites[i];
        var attrs;
        if (window.language == 'cs') {
            attrs = new Array(
                site.hostname,
                siteRank(site) + ' %',
                serpCount(),
                site.google_serp_count,
                site.seznam_serp_count,
                site.google_serp_count + site.seznam_serp_count,
                googleSerpPercent(site) + ' %',
                seznamSerpPercent(site) + ' %',
                serpPercent(site) + ' %'
            );
        } else {
            attrs = new Array(
                site.hostname,
                siteRank(site) + ' %',
                serpCount(),
                site.google_serp_count,
                serpPercent(site) + ' %'
            );
        }
        data.push(attrs);
    }

    return data;
}

function formatNumber(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function showCompetitionAnalysis() {
    var sorted_sites = sortSites(competitive_sites);
    var top_sites = sorted_sites.slice(0, 10);

    for (var i = 0; i < top_sites.length; i++) {
        var site = top_sites[i];
        showSite(site, i + 1);
    }
    $('#competitive_sites').removeClass('hide');

    $('#competitive_sites thead').click(function () {
        $(this).next('tbody').toggleClass('hide');
    });

    $('a.help').click(function () {
        return false;
    });
}

function showSite(site, position) {
    var css_class;

    if (position != 1) {
        css_class = 'class="hide" ';
    } else {
        css_class = '';
    }

    var html;

    if (position == 1) {
        if (window.language == 'cs') {
            html = '<table><thead> \
<tr> \
<th> \
<span>' + position + '.místo</span><br> \
<a href="http://' + site.hostname + '" target="_blank" class="site">' + site.hostname + '</a> \
</th> \
<th> \
Google \
</th> \
<th> \
Seznam \
</th> \
<th> \
Celkem \
</th> \
</tr> \
</thead>';
        } else {
            html = '<table><thead> \
<tr> \
<th> \
<span>' + position + '.místo</span><br> \
<a href="http://' + site.hostname + '" target="_blank" class="site">' + site.hostname + '</a> \
</th> \
<th> \
Google \
</th> \
</tr> \
</thead>';
        }
    } else {
        if (window.language == 'cs') {
            html = '<table class="pointer"><thead> \
<tr> \
<th> \
<span>' + position + '.místo</span><br> \
<a href="http://' + site.hostname + '" target="_blank" class="site">' + site.hostname + '</a> \
</th> \
<th> \
\
</th> \
<th> \
\
</th> \
<th> \
<img src="/sedm/images/layout/sel.png" alt="" class="sel2"> \
</th> \
</tr> \
</thead>';
        } else {
            html = '<table class="pointer"><thead> \
<tr> \
<th> \
<span>' + position + '.místo</span><br> \
<a href="http://' + site.hostname + '" target="_blank" class="site">' + site.hostname + '</a> \
</th> \
<th> \
<img src="/sedm/images/layout/sel.png" alt="" class="sel2"> \
</th> \
</tr> \
</thead>';
        }
    }

    if (window.language == 'cs') {
        html += '<tbody ' + css_class + '> \
<tr> \
<td> \
Počet výskytů na SERP \
</td> \
<td class="center"> \
<strong>(' + googleSerpPercent(site) + ' %)</strong><br> \
' + site.google_serp_count + ' \
</td> \
<td class="center"> \
<strong>(' + seznamSerpPercent(site) + ' %)</strong><br> \
' + site.seznam_serp_count + ' \
</td> \
<td class="center"> \
<strong>(' + serpPercent(site) + ' %)</strong><br> \
' + (site.google_serp_count + site.seznam_serp_count) + ' \
</td> \
</tr> \
<tr> \
<td> \
Analyzovaných SERP celkově \
</td> \
<td colspan="3"> \
' + serpCount() + ' \
</td> \
</tr> \
<tr> \
<td> \
Relativní síla URL&nbsp;&nbsp;<a href="#" class="help" title="Relativní síla webu je podíl součtu získaných bodů z výsledků vyhledávání a maximálního teoretického počtu bodů, které může web získat. Hodnocena je pouze první stránka výsledků vyhledávání. Web může získat 1 až 10 bodů v závislosti na tom, na které pozici se nachází. 10 bodů získá za první pozici, naopak 1 bod za desátou pozici. Čím větší relativní sílu web má, tím více je vidět ve výsledcích vyhledávání na zadaná klíčová slova."><img src="/sedm/images/layout/otaznik.png"></a> \
</td> \
<td colspan="3"> \
' + siteRank(site) + ' % \
</td> \
</tr> \
</tbody></table>';
    } else {
        html += '<tbody ' + css_class + '> \
<tr> \
<td> \
Počet výskytů na SERP \
</td> \
<td class="center"> \
<strong>(' + googleSerpPercent(site) + ' %)</strong><br> \
' + site.google_serp_count + ' \
</td> \
</tr> \
<tr> \
<td> \
Analyzovaných SERP celkově \
</td> \
<td colspan="3"> \
' + serpCount() + ' \
</td> \
</tr> \
<tr> \
<td> \
Relativní síla URL&nbsp;&nbsp;<a href="#" class="help" title="Relativní síla webu je podíl součtu získaných bodů z výsledků vyhledávání a maximálního teoretického počtu bodů, které může web získat. Hodnocena je pouze první stránka výsledků vyhledávání. Web může získat 1 až 10 bodů v závislosti na tom, na které pozici se nachází. 10 bodů získá za první pozici, naopak 1 bod za desátou pozici. Čím větší relativní sílu web má, tím více je vidět ve výsledcích vyhledávání na zadaná klíčová slova."><img src="/sedm/images/layout/otaznik.png"></a> \
</td> \
<td colspan="3"> \
' + siteRank(site) + ' % \
</td> \
</tr> \
</tbody></table>';
    }
    $('#competitive_sites .sites').append(html);
}

function sitePoints(site) {
    if (window.language == 'cs') {
        return site.google_points + site.seznam_points;
    } else {
        return site.google_points;
    }
}

function googleSerpPercent(site) {
    return roundNumber((100 / window.google_serp_count) * site.google_serp_count);
}

function seznamSerpPercent(site) {
    return roundNumber((100 / window.seznam_serp_count) * site.seznam_serp_count);
}

function serpCount() {
    if (window.language == 'cs') {
        return window.google_serp_count + window.seznam_serp_count;
    } else {
        return window.google_serp_count;
    }
}

function serpPercent(site) {
    if (window.language == 'cs') {
        return roundNumber((100 / serpCount()) * (site.google_serp_count + site.seznam_serp_count));
    } else {
        return roundNumber((100 / serpCount()) * (site.google_serp_count));
    }
}

function sortSites(sites) {
    var arr = sites.sort(function (a, b) {
        var a_points;
        var b_points;
        if (window.language == 'cs') {
            a_points = a.google_points + a.seznam_points;
            b_points = b.google_points + b.seznam_points;
        } else {
            a_points = a.google_points;
            b_points = b.google_points;
        }
        return (a_points == b_points) ? 0 : (a_points < b_points) ? 1 : -1;
    });
    return arr;
}

function siteRank(site) {
    var serp_count;
    var points;
    if (window.language == 'cs') {
        serp_count = window.google_serp_count + window.seznam_serp_count;
        points = site.google_points + site.seznam_points;
    } else {
        serp_count = window.google_serp_count;
        points = site.google_points;
    }

    var rank = (points / (serp_count * 10) * 100);
    return roundNumber(rank)
}

function roundNumber(number) {
    return Math.round(number * 10) / 10;
}

function initializeKeywordsClipboard() {
    var string_for_copy;
    if (window.language == 'cs') {
        string_for_copy = "Klíčové slovo\tPočet výsledků na Google\tPočet výsledků na Seznam.cz\tHledanost na Seznam.cz\tCena Kč na Seznam.cz\tKonkurence na Seznam.cz\n";
    } else {
        string_for_copy = "Klíčové slovo\tPočet výsledků na Google (" + window.language + ")\n";
    }
    for (var i = 0; i < dataForExport().length; i++) {
        for (var j = 0; j < dataForExport()[i].length; j++) {
            string_for_copy += dataForExport()[i][j] + "\t";
        }
        string_for_copy += "\n";
    }

    $('.keywords_copy').text(string_for_copy);
}

function initializeAnalysisClipboard() {
    var string_for_copy;

    if (window.language == 'cs') {
        string_for_copy = "URL\tRelativní síla URL [%]\tAnalyzovaných SERP celkově\tPočet výskytů na SERP Google\tPočet výskytů na SERP Seznam.cz\tPočet výskytů celkově\tPočet výskytů na SERP Google [%]\tPočet výskytů na SERP Seznam.cz [%]\tPočet výskytů celkově [%]\n";
    } else {
        string_for_copy = "URL\tRelativní síla URL [%]\tAnalyzovaných SERP celkově\tPočet výskytů na SERP Google\tPočet výskytů na SERP Google (" + window.language + ") [%]\n";
    }

    var data = dataForAnalysisExport().slice(0, 10);
    var indexes = new Array(1, 6, 7, 8);
    for (var i = 0; i < data.length; i++) {
        for (var j = 0; j < data[i].length; j++) {
            if (indexes.indexOf(j) == -1) {
                string_for_copy += data[i][j] + "\t";
            } else {
                string_for_copy += data[i][j].toString().replace('.', ',') + "\t";
            }
        }
        string_for_copy += "\n";
    }

    $('.analysis_copy').text(string_for_copy);
}

function showKeywordLogs() {
    var html = '';

    if (keyword_logs['seznam'].length > 0) {
        html += '<li><strong>Nepodařilo se získat počet výsledků na Seznam.cz pro klíčová slova:</strong> ' + keyword_logs['seznam'].join(', ') + '.</li>';
    }
    if (keyword_logs['sklik'].length > 0) {
        html += '<li><strong>Nepodařilo se získat hledanost na Seznam.cz pro klíčová slova:</strong> ' + keyword_logs['sklik'].join(', ') + '.</li>';
    }
    if (keyword_logs['google'].length > 0) {
        html += '<li><strong>Nepodařilo se získat počet výsledků na Google pro klíčová slova:</strong> ' + keyword_logs['google'].join(', ') + '.</li>';
    }

    var button_text;
    switch (logsCount()) {
        case 1:
            button_text = '!&nbsp;&nbsp;1 CHYBA';
            break;
        case 2:
        case 3:
        case 4:
            button_text = '!&nbsp;&nbsp;' + logsCount() + ' CHYBY';
            break;
        default:
            button_text = '!&nbsp;&nbsp;' + logsCount() + ' CHYB';
            break;
    }

    $('.keyword_logs .logs').html(html);
    $('.keyword_logs a.button').html(button_text);
    $('.keyword_logs').removeClass('hide');
}

function logsCount() {
    return window.keyword_logs['seznam'].length + window.keyword_logs['sklik'].length + window.keyword_logs['google'].length;
}

function notProcessedKeywordsCount() {
    return window.seznam_not_processed_keywords.length + window.google_not_processed_keywords.length + window.sklik_not_processed_keywords.length;
}

function GetURLParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            return sParameterName[1];
        }
    }
}

function googleRegexp() {
    switch (window.language) {
        case 'cs':
            return /Přibližný počet výsledků: ((\s|\d)+)/;
            break;
        case 'sk':
            return /Približný počet výsledkov: ((\s|\d)+)/;
            break;
        default:
            return /About ((,|\d)+) results/;
    }
}

function googleHost() {
    switch (window.language) {
        case 'cs':
            return 'cz';
            break;
        case 'sk':
            return 'sk';
            break;
        case 'en_GB':
            return 'co.uk';
            break;
        default:
            return 'com';
    }
}

