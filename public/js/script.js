
$(function () {

  const tableData = [
    { d1: "1,001", d2: "Lorem", d3: "ipsum", d4: "dolor", d5: "sit"},
    { d1: "1,002", d2: "amet", d3: "consectetur", d4: "adipiscing", d5: "elit"},
    { d1: "1,003", d2: "Integer", d3: "nec", d4: "odio", d5: "Praesent"},
    { d1: "1,003", d2: "libero", d3: "Sed", d4: "cursus", d5: "ante"},
    { d1: "1,004", d2: "dapibus", d3: "diam", d4: "Sed", d5: "nisi"},
    { d1: "1,005", d2: "Nulla", d3: "quis", d4: "sem", d5: "at"},
    { d1: "1,006", d2: "nibh", d3: "elementum", d4: "imperdiet", d5: "Duis"},
    { d1: "1,007", d2: "sagittis", d3: "ipsum", d4: "Praesent", d5: "mauris"},
    { d1: "1,008", d2: "Fusce", d3: "nec", d4: "tellus", d5: "sed"},
    { d1: "1,009", d2: "augue", d3: "semper", d4: "porta", d5: "Mauris"},
    { d1: "1,010", d2: "massa", d3: "Vestibulum", d4: "lacinia", d5: "arcu"},
    { d1: "1,011", d2: "eget", d3: "nulla", d4: "Class", d5: "aptent"},
    { d1: "1,012", d2: "taciti", d3: "sociosqu", d4: "ad", d5: "litora"},
    { d1: "1,013", d2: "torquent", d3: "per", d4: "conubia", d5: "nosa"},
    { d1: "1,014", d2: "per", d3: "inceptos", d4: "himenaeos", d5: "Curabitur"},
    { d1: "1,015", d2: "sodales", d3: "ligula", d4: "in", d5: "libero"}
  ];

  $(document).ready(function() {
    $('#place-dashboard').Template({
      template: {
        innerHtml: true
      },
      clearOnLoad: true,
      repeat: 4
    });

    const pager = $('#pager-dashboard').Pager({
      items: tableData.length * 16,
      containerStyle: "pagination justify-content-center",
      prevText: '\u00AB',
      nextText: '\u00BB'
    });

    const template = $('#list-dashboard tbody').Template({
      template: { innerHtml: true },
      data: tableData,
      clearOnLoad: true,
      'pager': {
        'itemsOnPage': 10
      },
      repeat: 16
    });

    pager.on('pagechanged', function (ev, index) {
      template.pager.moveTo(index);
    });

  });
});