/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define([], () => {
    const onDownload = () => {
        const actionField = document.getElementById('custpage_rr_action');
        if (actionField) {
            actionField.value = 'download';
        }
        const form = document.forms[0];
        if (form) {
            form.submit();
        }
    };

    return {
        onDownload
    };
});
