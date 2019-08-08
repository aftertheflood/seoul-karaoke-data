const fs = require('fs');
const d3 = require('d3');
const _ = require('lodash');
const {districts,columns} = require('./translations');

const dataFile = "./data/6110000_서울특별시_03_09_01_P_노래연습장업 - 노래연습장업_1.tsv";

const sheet = fs.readFileSync(dataFile,'utf-8');
const data = d3.tsvParse(sheet);

function includes(str, a){
  let inc = false;
  a.forEach(element => {
    inc = inc || String(str).indexOf(element) > -1;
  });
  return inc;
}

function monthlyCount(data){ // for a list of permits how many are active in a given month
  const monthDomain = d3.extent(data,d=>d.openDate);
  const current = new Date(monthDomain[0]);
  const format = d3.timeFormat('%Y-%m');
  const parse = d3.timeParse('%Y-%m');
  const months = [];
  while(current.getTime() < monthDomain[1].getTime()){
   months.push(format(current));
    current.setMonth(current.getMonth()+1);
  }
  return months.map(m=>{
    const month = parse(m).getTime();
    return {
      data: data.filter(d=>(month > d.openDate.getTime()
          &&
        (d.closeDate == null || month < d.closeDate.getTime()))),
      month: m
    }
  })
}

function fixYear(date){
  if(!date) return null;
  const fixed = new Date(date);
  const trimmedDigits = String(fixed.getFullYear()).slice(-2);

  if(trimmedDigits < 20){
    fixed.setYear(Number(`20${trimmedDigits}`));
  }else{
    fixed.setYear(Number(`19${trimmedDigits}`));
  }
  return fixed;
}

const parseDate = d3.timeParse("%Y%m%d");

const processed = data.map(d=>{
  // address column 소재지전체주소
  // 서울특별시 종로구 관철동 7-5번지 
  // XXXXXXX {name} XXX XXXXXX
  let district = d.소재지전체주소.split(' ')[1];
  // if the district contains one of the translated districts, 
  // cool, otherwise try again by a differnt method
  if(includes(district, Object.keys(districts))){
  }else{
    district = undefined;
  }
  const newRow = { 
    district,
    'district-en':districts[district]
  };

  newRow.openDate = parseDate( d.인허가일자 );
  newRow.closeDate = parseDate( d.폐업일자 || d.휴업시작일자 || d.휴업종료일자 );
  if(newRow.openDate < new Date(1980,1,1)){
    newRow.openDate = fixYear(newRow.openDate);
  }
  if(newRow.closeDate < new Date(1980,1,1)){
    newRow.closeDate = fixYear(newRow.closeDate);
  }
  let end = new Date();
  if(newRow.closeDate){
    end = newRow.closeDate
  }
  
  newRow.age = (end - newRow.openDate)/(1000*60*60*24*365); // in years

  return newRow;
})


fs.writeFileSync('./data/processed-data.tsv', d3.tsvFormat(processed));

const districtData = processed
  .filter((row)=>{
    return row.closeDate == null;
  })
  .reduce((acc, current)=>{
    if(!acc[current["district-en"]]){
      acc[current["district-en"]] = [];
    }
    acc[current["district-en"]].push(current);
    return acc;
  },{});

fs.writeFileSync('./data/districts.json', JSON.stringify(districtData,null,' '));

const monthlyTally = {};
Object.keys(districtData).forEach((districtName)=>{
  monthlyTally[districtName] = monthlyCount( districtData[districtName] )
    .map(d=>({
      month: d.month, count: d.data.length
    }))
    .sort((a, b)=>{
      return a-b;
    });
});

fs.writeFileSync('./data/district-monthly-counts.json', JSON.stringify(monthlyTally,null,' '));

const ageScale = d3.scaleLinear()
    .domain([0, 20])
    .rangeRound([0, 300]);

const districtAge = {};
const ageBin = d3.histogram()
  .value(d=>d)
  .domain(ageScale.domain())
  .thresholds(ageScale.ticks(20));

Object.keys(districtData).forEach((districtName)=>{
  const ages = districtData[districtName].map(d=>d.age);
  districtAge[districtName] = {
    bins: ageBin(ages),
    mean: d3.mean(ages)
  }
})

fs.writeFileSync('./data/district-age-distributions.json', JSON.stringify(districtAge,null,' '));


const openingScale = d3.scaleTime()
  .domain([new Date(1995, 1, 1), new Date()])
  .rangeRound([0, 300]);

const yearCount = openingScale.domain()[1].getFullYear() - openingScale.domain()[0].getFullYear();

const openingDistribution = {};
const openingBin = d3.histogram()
  .value(d=>d)
  .domain(openingScale.domain())
  .thresholds(openingScale.ticks(yearCount))

console.log(yearCount);

Object.keys(districtData).forEach((districtName)=>{
  const openDates = districtData[districtName].map(d=>d.openDate);
  openingDistribution[districtName] = {
    bins: openingBin(openDates),
    mean: new Date(d3.mean(openDates))
  }
});

console.log(openingDistribution);

// const monthlyVenueCount = monthlyCount(processed); // monthly counts for everything

