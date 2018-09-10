function termFind() {
    //getting season and year to calculate the term number
    var term = document.getElementsByClassName("PABOLDTEXT")[0].innerText.split("|")[0].split(" ")
    var season = term[0]
    var year = term[1]
    
    //using the following as a base:
	//Winter 2018 is 1181
    //Spring 2018 is 1185
    //Fall 2018 is 1189
    //Winter 2019 is 1191
    var seasonTerm = {Winter: 1181, Spring: 1185, Fall: 1189}

    var multiplier = year - 2018
	//this should be the pattern, but not 100% 
    return seasonTerm[season] + 10 * multiplier
}

function getReq(url){
    //GET request
    var xhr = new XMLHttpRequest()
    xhr.open("GET", url, false)
    xhr.send()
    return xhr.responseText
}

function amPmChecker(time, start = false){
    //since site doesn't list in 24h and doesn't specify AM or PM, have to make a guess
    //earliest class is at 0830 so any times between 0000 and 0829 should be in PM
    //likewise, if the class starts in pm, will end in pm; so a class starting at "0630" and ending at "0920"
    //should actually be 1830 and 2120, even though 0830 < 0920 in this case
    if(start || time < 830){
        return parseInt(time) + 1200
    } else {
        return time
    }
}

function dayExtracter(days){
    //converting days of the week to proper iCal format
    var daysArray = []
    if (days.includes("M")){
        daysArray.push("MO")
    }
    if (days.includes("W")){
        daysArray.push("WE")
    }
    if (days.includes("F")){
        daysArray.push("FR")
    }
    //luckily doesn't have to be in order to work
    if (days.includes("Th")){
        daysArray.push("TH")
        //to make it easy for Tuesday searching "T"
        days = days.replace("Th","")
    }
    if (days.includes("T")){
        daysArray.push("TU")
    }
    return daysArray.join(",")
}

function constructDateTime(date, time){
    //getting the iCal date and time format
    return date.getFullYear() + ("0" + (date.getMonth() + 1)).slice(-2) + ("0" + date.getDate()).slice(-2) + "T" + time + "00"
}

function download(filename, text) {
    var element = document.createElement('a')
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text))
    element.setAttribute("download", filename)
  
    element.style.display = "none"
    document.body.appendChild(element)
  
    element.click()
  
    document.body.removeChild(element)
  }

function icalCreate(){
    var term = termFind()
    var counter = 0
    //look for the checked boxes only
    var checkbox = document.getElementsByClassName("tickerbox")
    var ical = "BEGIN:VCALENDAR\n" +
        "PRODID:-//gitCommitWiL//UW Alter Schedule Creator//EN\n" +
        "VERSION:2.0\n"
    
    var checkbox = document.getElementsByClassName("tickerbox")
    //skip all non LEC and TUT
	var skipSec = 0
	//count the number of TUT (used later on to properly search for TUT sections)
	var tutCount = 0
	//look for the checked boxes only
    for (var i = 0; i < checkbox.length; i++){
        if(!checkbox[i].checked){
            continue
        }

        //have to get the section number of the lec to prevent overlap, get start/ end date as well to use for later
        //so I'm not entirely sure about this, but I think the first one should be the LEC; I think TUT and TST come later
		//so I saw one case where TST is actually the first row, so need to change that
		
		//below usually runs once, but not sure if there are any cases out there that need this loop
		while(true){
			//in addtion to check for LEC andc TUT, also check that the box ID matches up (i.e. skip unchecked boxes)
			if((document.getElementById("MTG_COMP$" + (i + skipSec)).innerText != "LEC" && document.getElementById("MTG_COMP$" + (i + skipSec)).innerText != "TUT") || !( document.getElementById("MTG_COMP$" + (i + skipSec)).innerHTML.includes("checkbox" + i))){
				skipSec+=1
			} else {
				break
			}
		}
		
		
        //there's a space after the section #, as per the site
        var origSection = document.getElementById("MTG_COMP$" + (i + skipSec)).innerText + " " + document.getElementById("MTG_SECTION$" + (i + skipSec)).innerText + " "
        var startEndDate = document.getElementById("MTG_DATES$" + (i + skipSec)).innerText.split(" - ")
        var startDate = startEndDate[0].split("/")
        //var startDateProper = startDate[2] + startDate[0] + startDate[1]

        //did you know that Javascript has its months zero indexed? I didn't know that. Until after an hour of pulling my hair out. WHY WOULD YOU DO THIS
        var startD = new Date(startDate[2], startDate[0] - 1, startDate[1])
        //starting date is 1 day before actual start date; if starting day is a T but class is every MWF this makes it easier to exclude that T so start on W
        startD.setDate(startD.getDate() - 1 )
        var endDate = startEndDate[1].split("/")
        var endD = new Date(endDate[2], endDate[0] - 1, endDate[1])
        //similar logic with end date
        endD.setDate(endD.getDate() + 1 )

        //ignore online "lectures"
        //there's a space after the section #, as per the site
        var lecSecs = {'LEC 081 ': true}
        lecSecs[origSection] = true
        var classes = document.getElementsByClassName("PAGROUPDIVIDER")
        //if include tutorial, it will mess up the i count sometimes
        //here's a messy way to deal with it, assuming lectures are always listed before tutorials
        if(checkbox[i].parentNode.innerText == "TUT"){
            tutCount += 1
		}
		var j = i - tutCount
        var text = classes[j].innerText
        text = text.split("-")
        var course = text[0].split(" ")
        var description = text[1]
        var subject = course[0]
        var cournum = course[1]
        var url = "https://info.uwaterloo.ca/cgi-bin/cgiwrap/infocour/salook.pl?sess=" + term + "&level=under&subject=" + subject + "&cournum=" + cournum
        var resp = getReq(url)
        //turn into html object so can grab required info
        var htmlObject = document.createElement("div")
        htmlObject.innerHTML = resp;
        //everything is in a simple table so not much to use; get rows for the info
        var tr = htmlObject.getElementsByTagName("tr")
        //for each TR search to see if childrenElementCount is 13 AND see if innerText contains LEC AND Comp Sec is not in lecSecs (this prevents curious cases like CS 245 and CS 245E; they share the same Comp Sec, most of the time)
        for (var j = 0; j < tr.length; j++){
            //13 is for full list, but sometimes instructor is missing for TUT, so in that case 12 is acceptable
            if(((tr[j].childElementCount == 13 && (document.getElementById("MTG_COMP$" + (i + skipSec)).innerText == "LEC" || document.getElementById("MTG_COMP$" + (i + skipSec)).innerText == "TUT")) || (tr[j].childElementCount == 12 && document.getElementById("MTG_COMP$" + (i + skipSec)).innerText == "TUT")) && tr[j].innerText.includes(document.getElementById("MTG_COMP$" + (i + skipSec)).innerText) && lecSecs[tr[j].children[1].innerText] == null){
                var classNum = tr[j].children[0].innerText
                var compSec = tr[j].children[1].innerText
                var campLoc = tr[j].children[2].innerText
                var date = tr[j].children[10].innerText.split("\n")[0].split("-")
                //splitting on "\n" will get rid of those Laurier clasess that have both the start/end date and times 
					
				//if TBA date, skip as not useful
				if(date == "TBA" || date == ""){
					continue
				}	
                var startTime = date[0].replace(":","")
                startTime = amPmChecker(startTime)
                var endTime = date[1].substring(0,5).replace(":","")
                var startBool = false
                //if start is in PM, need to add 1200 to end, in particular for classes that start at 6:30pm
                if (startTime > 1200){
                    startBool = true
                }
                endTime = amPmChecker(endTime, startBool)
                var days = date[1].substring(5)
                //for whatever reason, times are not listed in 24 hours; so to prevent an AM/ PM mixup
                //earliest class should be 8:30 AM, so any number less than 0830, add 1200 to it
                var classDays = dayExtracter(days)
                
                var room = tr[j].children[11].innerText
				//if TBA room, skip as not useful
				if(room== "TBA" || room == ""){
					continue
				}	
                if (tr[j].children[12] != null){
                    var instructor = tr[j].children[12].innerText
                } else {
                    var instructor = "TBA"
                }
                
                //add section so that (hopefully) won't run into CS 245 and CS 245E case 
                lecSecs[tr[j].children[1].innerText] = true

                //construct ical event entry
                var iCalEvent = "BEGIN:VEVENT\n" +
                    "DESCRIPTION:" +
                        "Section: " + compSec + "\\n" +
                        "Instructor: " + instructor + "\\n" +
                        "Class Number: " + classNum + "\\n\n" +
                    "DTEND;TZID=America/Toronto:" + constructDateTime(startD, endTime) + "\n" +
                    "DTSTART;TZID=America/Toronto:" + constructDateTime(startD, startTime) + "\n" +
                    "LOCATION:" + room + "\n" +
                    "RRULE:FREQ=WEEKLY;UNTIL=" + constructDateTime(endD, endTime) + "Z;BYDAY=" + classDays + "\n" +
                    "EXDATE;TZID=America/Toronto:" + constructDateTime(startD, startTime) + "\n" +
                    "SUMMARY:" + subject + " " + cournum + " - " + description + " (" + document.getElementById("MTG_COMP$" + (i + skipSec)).innerText + ")" + "\n" +
                    "TRANSP:TRANSPARENT\n" +
                    "END:VEVENT\n"
                ical += iCalEvent
                counter++
            }
        }
        
    }
    ical += "END:VCALENDAR\n"
    console.log(ical)
    if (counter == 0){
        alert("No additional sections found")
    } else {
        /*if (counter == 1) {
            alert("Found 1 other lecture!")
        } else {
            alert("Found " + counter + " other lectures!")
        }*/
        var term = document.getElementsByClassName("PABOLDTEXT")[0].innerText.split("|")[0].split(" ").join("")
        var name = document.getElementById("DERIVED_SSTSNAV_PERSON_NAME").innerText.replace(" ","")
        var file = name + term + "AlterSchedule.ics"
        download(file, ical)
    }
}

var intervalCheck

function check(){
    //stop the interval checks
    clearInterval(intervalCheck)
    var title = document.getElementsByClassName("PATRANSACTIONTITLE")[0]
    //check if on right page
    if(document.getElementById("DERIVED_SSS_SCT_SSR_PB_GO") == null && title != null && title.innerText == "My Class Schedule" && document.getElementsByClassName("PSRADIOBUTTON")[0].checked){
        var classes = document.getElementsByClassName("PAGROUPDIVIDER")
        var checkboxId = 0
		//add checkboxes
        for (var k = 0; k < classes.length * 2; k++){
            if (document.getElementById("MTG_COMP$" + k) != null)
                if (document.getElementById("MTG_COMP$" + k).innerText == "LEC"){
                    document.getElementById("MTG_COMP$" + k).innerHTML += "<input type='checkbox' checked='true' class='tickerbox' id='checkbox" + checkboxId + "'>"
					checkboxId += 1
                } else if (document.getElementById("MTG_COMP$" + k).innerText == "TUT"){
                    //by default, TUT are unchecked
                    document.getElementById("MTG_COMP$" + k).innerHTML += "<input type='checkbox' unchecked='true' class='tickerbox' id='checkbox" + checkboxId + "'>"
					checkboxId += 1
                }
        }
        //add hyperlink
        title.innerHTML += " (<a id='dLSched' href='#' >Download Alter Schedule [uncheck component to exclude]</a>)"
        var sched = document.getElementById("dLSched")
        sched.addEventListener('click', function(){
            icalCreate()
        })
    } else{
        //this is only for "Select a term" page. Clicking continue after selecting a term was being a little weird
        //the solution I came up for it was just to cheeck every 1.5 seconds to see if a term was selected 
        if (title != null && title.innerText == "My Class Schedule" && document.getElementById("DERIVED_SSS_SCT_SSR_PB_GO") != null) {
            interCheck()
        }
    }
}

function interCheck(){
    intervalCheck = setInterval(check, 1500)
}

if (document.readyState !== 'loading'){
    check()
} else {
    document.addEventListener("DOMContentLoaded", function(){ 
        check()
    }, false)
}
