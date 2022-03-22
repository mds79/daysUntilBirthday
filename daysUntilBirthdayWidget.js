//////////////////////////////////
// how to use:
// This script has a widget mode and an interactive mode. To activate the interactive mode set "when interacting" to "run script" within the widget configuration or start the script within the scriptable app.
// In the interactive mode you can select which adressbooks (containers) should be used. The selection is stored in the scriptable folder.
// !!! At first run no adressbook (container) is selected. Therefore, start from scriptable app the first time.
// 
// Mode 1 (default): Only chosen contacts:
// in your contacts app, edit the contacts you want to be visible in this widget
// -> you need to set up an additional 'date' field in your contact and give the date the label 'daysUntilBirthday'
// when you add new contacts via the label, run the script again in the app to update the database
// when setting the script as Widget, use the largest presentation mode.
//
// Mode 2: Show all contacts with a Birthday configured
// set the next variable to true or provide the parameter 'showAll' in widget mode to show all contacts that have a birthday in the regular birthday field configured
//
let showAllContacts = true;

// everytime the script is started in scriptable contacts are scanned
// birthdays are calculated when the widget is running
//////////////////////////////////

const showFamilyName = true; // Show family names or first names only
const amountOfContacts = 8; // How many contacts to show
const numberOfColumns = (showFamilyName? 1 : 2);  //If family names are shown use only 1 column else use two columns

// if available show the image of the person from the adressbook
const showImage = true;

// pressing the contact opens a shortcut action via x-callback-url. You need to create the shortcut first. It should show the contact data of the person. However, it is very slow. (Takes several seconds)
// This is an optional feature.
const openContactInShortcuts = false;
const nameOfShortcut = "OpenContact";

// You can send a prepared birthday message when pressing. 
// change the messageStandardText to "Happy birthday %%" or whatever you need in the language settings.
// The message is only prepared but not send. Sending requires userinteraction. You can edit the prepared text according to your need.
const activateSendScript = "today" 
// Use the following choices
// "always" any contact can be selected for the prepared message
// "today" message will only get prepared if the persons birthday is today
// "first" the first contact is interactive
// "never" - or anything else. No send function


// file name of the selected adressbooks.
const configFile = "adressBooksForBirthday.json"

// file name of the custom contacts data
const customContactsFile = "customContacts2.json"

// load the setting which adressbooks (containers) should be used.
let allContainers = await ContactsContainer.all();
let containers = [];// 
let containersID = loadCustomFile(configFile);

// For mode 1 only:
// the label name you need to set in contacts on the first date field
const contactNotesKeyWord = 'daysUntilBirthday';

//////////////////////////////////

// edit these according to your language
const daysUntilBirthdayText = 'Tage bis zum Geburtstag von';
const daysText = 'Tage';
const todayText = 'Heute!';
const instructionText = "no birthdays found\nset 'when interacting' to 'run script'\nThen press widget to select adressbooks or run script in the app"
const messageStandardText = "Hallo %%, alles Gute zum Geburtstag!" // "Hello %%, happy birthday!"
//////////////////////////////////

const dateFormatter = new DateFormatter();
dateFormatter.dateFormat = 'dd.MM.yyyy';
const timeFormatter = new DateFormatter();
timeFormatter.dateFormat = 'dd.MM.yyyy HH:mm:ss';

const headerFont = new Font('Menlo-regular', 14);
const contactNameFont = new Font('Menlo-regular', 17);
const smallInfoFont = new Font('Menlo-regular', 10);
const updatedAtFont = new Font('Menlo-regular', 7);
const fontColorGrey = new Color("#918A8A");
//const fontColorWhite = new Color("#FFFFFF");
const todayColor = Color.red()

// configuration of thumb images
const sizeOfThumbs = 100;
const refreshThumbs = false;
const img = SFSymbol.named("person.circle");
const emptyImage = img.image

// used for inserting space characters
const lineLength = 7;


// class that is also serialized to a json file in iCloud
class CustomContact {
    constructor(givenName, familyName, nickName, birthday, phone) {
        this.givenName = givenName;
        this.familyName = familyName;
        this.nickName = nickName;
        this.birthday = birthday
        this.phone = phone
    }

    // the shorter nickname is preferred
    name(){
        let contactsName = (this.nickName ? this.nickName : this.givenName)
            contactsName = contactsName.split(' ')[0]
        return contactsName;
    }
    getAsKey() {
        // name and birthday together make the contact unique
        return this.givenName + '-' + this.familyName + '-' + dateFormatter.string(new Date(this.birthday));
    }
    daysUntilFn(){
        return calculateDaysUntil(this.birthday)
    }
    
}

// present a table to select the used adressbooks (containers)
let table = new UITable();
let shownCustomContacts = []
log(args.queryParameters)

//widget.backgroundColor = new Color("#000000");


// Three ways to run the script.
// 1. As Widget: the birthdays will be shown
// 2. Within the app: Select the used adressbooks. Adressbooks will be scanned and thumbs of the images will be created
// 3. Run via x-callback-url: A Message will be prepared with given name and phone number from input, given as parameter

if (config.runsInWidget){
    const widget = await createWidget();
    Script.setWidget(widget);

} else if (args.queryParameters.input){
    const contactName = decodeURI(args.queryParameters.input)
    const messageText = messageStandardText.replace("%%", contactName)
    const messagePhone = decodeURI(args.queryParameters.phone)
    let message = new Message();
    message.body = messageText;
    message.recipients=[messagePhone]
    message.send() // iMessage-template will pop up. User has to confirm the sending. Message will not send automatically
} else {
    await initialData()
    const widget = await createWidget();
    await widget.presentLarge();
    Script.setWidget(widget);
}
Script.complete();

async function createWidget() {
    const widget = new ListWidget();
    let headerRow = widget.addStack();
    let headerText = headerRow.addText(daysUntilBirthdayText);
        headerText.textColor = fontColorGrey;
        headerText.font = headerFont;
    let shownCustomContacts = [];

    for (let contact of loadCustomFile(customContactsFile)) {
        let con = new CustomContact(contact.givenName, contact.familyName, contact.nickName, contact.birthday, contact.phone)
        shownCustomContacts.push(con)
    }

    // sorts contacts by how near their birthday is
    shownCustomContacts.sort(function (a, b) {
        return a.daysUntilFn() > b.daysUntilFn();
    });

    // this row consists of one or two customContact infos
    let currentRow;
    // counter for creating one or two columns and a maximum of 20 visible contacts
    let contactCounter = 0;

    for (let customContact of shownCustomContacts) {
        if (contactCounter >= (amountOfContacts * numberOfColumns)) {
            // only the top earliest birthdays are shown in the widget
            break;
        }
        if (contactCounter % numberOfColumns === 0) {
            // start a new row
            currentRow = widget.addStack();
            currentRow.centerAlignContent()
            if (showImage && (numberOfColumns === 1)){
                let img = loadThumb(customContact.getAsKey())
                let stackImage = currentRow.addImage(img)
                    stackImage.cornerRadius = 25
                currentRow.addSpacer(5)
            }
        }
        addContactInfoToRow(customContact, currentRow);
        if (activateSendScript === "always" || (activateSendScript === "first" && contactCounter === 0 ) || (activateSendScript === "today" && customContact.daysUntilFn() === 0)) {
            currentRow.url = "scriptable:///run/" + Script.name() + "?input=" + encodeURI(customContact.name()) + "&phone=" + encodeURI(customContact.phone) 
        }

        contactCounter++;
        if (contactCounter < (amountOfContacts * numberOfColumns)) {
            widget.addSpacer(1);
        }
    }
    if (contactCounter === 0) {
        currentRow = widget.addStack()
        currentRow.addText(instructionText)
    }

    let updatedAt = widget.addText('Update: ' + timeFormatter.string(new Date()));
    updatedAt.font = updatedAtFont;
//    updatedAt.textColor = fontColorWhite;
    updatedAt.centerAlignText();
    return widget;
}


// create the table with boxes to select or unselect adressbooks (containers).
function createTable (){
	table.removeAllRows();
   for (let i of allContainers){
		let selected = (containersID.includes(i.identifier)? true : false);
 	  	let row = new UITableRow()// 
	   let ticks = row.addButton( selected? "✅" : "⭕️");
		ticks.widthWeight = 10;
		ticks.onTap = () => {
			i_value = i;
         if (selected) {
				containers.splice(containers.indexOf(i_value),1)
				containersID.splice(containersID.indexOf(i_value.identifier),1)
				createTable();
    
    		} else {
				containers.push(i);
				containersID.push(i.identifier)
				createTable();
 			}
    	}
		let partText = row.addText(i.name);
		partText.widthWeight = 90;
		table.addRow(row);     
   }
	table.reload();
}


// used to align the information
function addSpaces(amount, row) {
    for (let i = 0; i < amount; i++) {
        let text = row.addText(' ');
        text.font = contactNameFont;
    }
}

function addContactInfoToRow(customContact, row) {
//    addSpaces(lineLength - customContact.name().length, row);
    let nameText = customContact.name() + (showFamilyName? " " + customContact.familyName: "")// showFAmilyName 
    let nameRow = row.addText(nameText);
        nameRow.font = contactNameFont;
//        nameRow.textColor = fontColorWhite;

    if (openContactInShortcuts) {
    	 row.url = "shortcuts://x-callback-url/run-shortcut?name=" + nameOfShortcut+"&input=text&text=" + encodeURI(customContact.familyName) + "XXX" +    		 encodeURI(customContact.givenName)
    }


    let actualText = (customContact.daysUntilFn() === 0 ? ' ' + todayText + '\n ' : ' ' + customContact.daysUntilFn() + ' ' + daysText + '\n ') + dateFormatter.string(new Date(customContact.birthday)).replace('.2222', '.????') ;

    let daysInfoText = row.addText(actualText);
        daysInfoText.textColor =  (customContact.daysUntilFn() === 0 ? todayColor : fontColorGrey );
        daysInfoText.font = smallInfoFont;
}

function calculateDaysUntil(birthdayString) {
    let startDate = new Date();
    let targetDate = new Date(birthdayString);
    targetDate.setFullYear(startDate.getFullYear());

    let timeRemaining = parseInt((targetDate.getTime() - startDate.getTime()) / 1000);

    if (timeRemaining < 0) {
        // the date was in the past -> recalculate for next year
        targetDate.setFullYear(targetDate.getFullYear() + 1);
        timeRemaining = parseInt((targetDate.getTime() - startDate.getTime()) / 1000);
    }

    if (timeRemaining >= 0) {
        let days = 1 + parseInt(timeRemaining / 86400);
        return parseInt(days, 10) % 365;
    } else {
        return '???';
    }
}

// recalculates the daysUntil value of the customContacts
function updateCustomContacts(customContacts) {
    for (let contact of customContacts) {
        let date = dateFormatter.date(contact.date);
        date = getFixedDate(date);
        contact.daysUntil = calculateDaysUntil(date.toString());
    }
}

// loads contacts stored in the json
function loadCustomFile(fileName) {
    // this could be changed to FileManager.iCloud() if you don't want to use iCloud
    let fm = FileManager.local();
    let path = getFilePath(fileName);
    if (fm.fileExists(path)) {
        let raw = fm.readString(path);
        return JSON.parse(raw);
    } else {
        return [];
    }
}

// Saves the data to a local file.
function saveCustomFile(fileName, customData) {
    // this could be changed to FileManager.local() if you don't want to save local
    let fm = FileManager.local();
    let path = getFilePath(fileName);
    let raw = JSON.stringify(customData);
    fm.writeString(path, raw);
}

// Gets path of the file containing the stored data. Creates the file if necessary.
function getFilePath(fileName) {
    let fm = FileManager.local();
//     let dirPath = fm.joinPath(fm.bookmarkedPath("Scriptable_Files"), "daysUntilBirthdayData");
    let dirPath = fm.joinPath(fm.documentsDirectory(), "daysUntilBirthdayData");
    if (!fm.fileExists(dirPath)) {
        fm.createDirectory(dirPath);
    }
    return fm.joinPath(dirPath, fileName);
}

function getFixedDate(date) {
    if (date?.getFullYear() === 1) {
        // crazy bug in ios contacts if no year is set...
        date = new Date(2222, date.getMonth(), date.getDate());
        date.setDate(date.getDate() + 2);
    }
    return date;
}

async function initialData() {
    // select adressbooks 
    table.dismissOnTap = false
	 createTable(); 
	 await table.present(); 
	 saveCustomFile(configFile, containersID)

    // read contacts with birthday
    //instead of contactsInIos = await Contact.all(containers) the containers are loaded one by one and filterd in order to save memory
    // only contacts with birthday available are used.
    for (let i of allContainers){
        if (containersID.includes(i.identifier)){
            containers.push(i)
        }
    }
    let contactsInIos = []
    for (let con of containers){
        let book = await Contact.all([con])
        let filteredContacts = book.filter(contact => {
            return (contact.birthday != null)
        })
        contactsInIos = contactsInIos.concat(filteredContacts)
    }

    // Overwrite the default value on top when running as widget
    // working parameter example: 'showAll'
    if (args.widgetParameter) {
        if (args.widgetParameter.includes('showAll')) {
            showAllContacts = true;
        }
    }
    // When running with showAllContacts = false filter contacts according to entry
    // Mode 1: only show chosen contacts
    // contacts need to have an additional date property named like the content of variable contactNotesKeyWord
    // Mode 2: show all contacts with a regular birthday field set
    if (!showAllContacts) {
        contactsInIos = ContactsInIos.filter(contact =>  {
            let useValue = false;
            for (let date of contact.dates) {
                if (date.label.startsWith(contactNotesKeyWord)) {
                    useValue = true
                }
            }
            return useValue;
        })
    }

    // prevent two similar entries
    let keysForDuplicatePrevention = [];
    for (let contact of contactsInIos) {
//        let dateToUse = null; // if set, a contact is found
        let dateToUse = contact.birthday;
        dateToUse = getFixedDate(dateToUse);
/*        if (!dateToUse) {
            // contact should not be shown -> continue to the next contact
            continue;
        }
*/        
        // if here: contact will be stored
         
        // next line removes emoji that come after a space character
//        contactsName = contactsName.split(' ')[0] + (showFamilyName? " " + contact.familyName : "");

        let foundContact = new CustomContact(contact.givenName, contact.familyName, contact.nickname, contact.birthday, searchPhoneNumber(contact))

        // check if already found before (in case of multiple contact containers)
        if (!keysForDuplicatePrevention.includes(foundContact.getAsKey())) {
            keysForDuplicatePrevention.push(foundContact.getAsKey());
            shownCustomContacts.push(foundContact);
        }

        // create thumbnails pictures
        if (contact.isImageAvailable) {
            createThumb(contact, foundContact.getAsKey())
        }
    }
    // write data to json in iCloud
    saveCustomFile(customContactsFile, shownCustomContacts);
}

// search for phone number, iphone is prefered for mobile phone.
function searchPhoneNumber(contact){
    let phone = ""
    if (contact.isPhoneNumbersAvailable) {
        let phoneNumbers = contact.phoneNumbers
        // use iPhone. If not awailable use Mobil
        let phoneID = phoneNumbers.findIndex(idx=>(idx.label === "iPhone"))
        if (phoneID < 0 ) {
            phoneID = phoneNumbers.findIndex(idx=>(idx.label === "_$!<Mobile>!$_"))
        }
        if (phoneID > -1) {
           phone = contact.phoneNumbers[phoneID].value
        }
    }
    return phone
}


// create thumb with name getAsKey.jpg. Skip it, if refreshThumbs = false or file already exists.
function createThumb(contact, nameOfThumb){
    let fileName = nameOfThumb + ".jpg"
    let path = getFilePath(fileName);
    let fm = FileManager.local();
    if( !fm.fileExists(path) || refreshThumbs ){
        let image = contact.image
        if (image != null) {
            let thumb = new DrawContext
                thumb.size = new Size(sizeOfThumbs, sizeOfThumbs * image.size.height / image.size.width)
                thumb.drawImageInRect(image, new Rect(0, 0, sizeOfThumbs, sizeOfThumbs * image.size.height / image.size.width))
            fm.writeImage(path, thumb.getImage())
        }
    }
}

function loadThumb(nameOfThumb){
    let fm = FileManager.local()
    let fileName = nameOfThumb + ".jpg"
    let path = getFilePath(fileName);
    if (fm.fileExists(path)) {
        return fm.readImage(path)
    } else {
        return emptyImage
    }
}
